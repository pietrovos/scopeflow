-- Tenant isolation and client visibility, enforced by Postgres.
--
-- The API sets three transaction-local settings before touching tenant data
-- (see apps/api/src/db/tenant-db.service.ts):
--   app.org_id   the organization in the URL, after the membership check
--   app.user_id  the signed-in user
--   app.role     that user's role in the organization
-- Missing settings resolve to NULL / 'NONE', so a query run without context sees nothing.

CREATE FUNCTION app_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'NONE') $$;

CREATE FUNCTION app_is_staff() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('OWNER', 'ADMIN', 'MEMBER') $$;

-- Staff see every project in the org; clients see only projects they are assigned to.
CREATE FUNCTION app_can_see_project(p uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT app_is_staff() OR EXISTS (
      SELECT 1 FROM project_assignments a
      WHERE a.project_id = p AND a.user_id = app_user_id() AND a.org_id = app_org_id()
    )
  $$;

-- organizations ---------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_select ON organizations FOR SELECT USING (
  id = app_org_id()
  OR EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = organizations.id AND m.user_id = app_user_id())
);
CREATE POLICY org_insert ON organizations FOR INSERT WITH CHECK (id = app_org_id());
CREATE POLICY org_update ON organizations FOR UPDATE USING (id = app_org_id()) WITH CHECK (id = app_org_id());

-- memberships: staff see the org's members; everyone sees their own memberships
-- (that is how the org switcher lists organizations).
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_select ON memberships FOR SELECT USING (
  user_id = app_user_id() OR (org_id = app_org_id() AND app_is_staff())
);
CREATE POLICY membership_write ON memberships FOR ALL
  USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());

-- invitations: staff only
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitation_all ON invitations FOR ALL
  USING (org_id = app_org_id() AND app_is_staff())
  WITH CHECK (org_id = app_org_id() AND app_is_staff());

-- project_assignments
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignment_all ON project_assignments FOR ALL
  USING (org_id = app_org_id() AND (app_is_staff() OR user_id = app_user_id()))
  WITH CHECK (org_id = app_org_id());

-- projects and everything hanging off a project
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_all ON projects FOR ALL
  USING (org_id = app_org_id() AND app_can_see_project(id))
  WITH CHECK (org_id = app_org_id());

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_all ON milestones FOR ALL
  USING (org_id = app_org_id() AND app_can_see_project(project_id))
  WITH CHECK (org_id = app_org_id() AND app_can_see_project(project_id));

ALTER TABLE scope_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY scope_change_all ON scope_changes FOR ALL
  USING (org_id = app_org_id() AND app_can_see_project(project_id))
  WITH CHECK (org_id = app_org_id() AND app_can_see_project(project_id));

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comment_all ON comments FOR ALL
  USING (org_id = app_org_id() AND app_can_see_project(project_id))
  WITH CHECK (org_id = app_org_id() AND app_can_see_project(project_id));

-- Revisions and decisions inherit visibility from their scope change (whose own
-- policy is applied inside the EXISTS).
ALTER TABLE scope_change_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY revision_select ON scope_change_revisions FOR SELECT USING (
  org_id = app_org_id() AND EXISTS (SELECT 1 FROM scope_changes s WHERE s.id = scope_change_id)
);
CREATE POLICY revision_insert ON scope_change_revisions FOR INSERT WITH CHECK (
  org_id = app_org_id() AND EXISTS (SELECT 1 FROM scope_changes s WHERE s.id = scope_change_id)
);

ALTER TABLE scope_change_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_select ON scope_change_decisions FOR SELECT USING (
  org_id = app_org_id() AND EXISTS (SELECT 1 FROM scope_changes s WHERE s.id = scope_change_id)
);
CREATE POLICY decision_insert ON scope_change_decisions FOR INSERT WITH CHECK (
  org_id = app_org_id() AND EXISTS (SELECT 1 FROM scope_changes s WHERE s.id = scope_change_id)
);

-- activity: org-level events (no project) are staff-only.
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_select ON activity_events FOR SELECT USING (
  org_id = app_org_id() AND CASE
    WHEN project_id IS NULL THEN app_is_staff()
    ELSE app_can_see_project(project_id)
  END
);
CREATE POLICY activity_insert ON activity_events FOR INSERT WITH CHECK (org_id = app_org_id());

-- Append-only tables -----------------------------------------------------------
-- The app role cannot UPDATE or DELETE them at all, and a trigger stops anyone else
-- from rewriting history. (Deletes still cascade when an organization is removed.)
REVOKE UPDATE, DELETE ON scope_change_revisions, scope_change_decisions, activity_events FROM scopeflow_app;

CREATE FUNCTION reject_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END $$;

CREATE TRIGGER scope_change_revisions_immutable BEFORE UPDATE ON scope_change_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_update();
CREATE TRIGGER scope_change_decisions_immutable BEFORE UPDATE ON scope_change_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_update();
CREATE TRIGGER activity_events_immutable BEFORE UPDATE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION reject_update();

-- Cross-tenant references ------------------------------------------------------
-- Foreign key checks ignore RLS, so without this a row in org A could point at a
-- project in org B. These triggers require child rows to share their parent's org.
CREATE FUNCTION assert_project_in_org() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'project % does not belong to org %', NEW.project_id, NEW.org_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION assert_scope_change_in_org() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM scope_changes WHERE id = NEW.scope_change_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'scope change % does not belong to org %', NEW.scope_change_id, NEW.org_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER project_assignments_same_org BEFORE INSERT OR UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION assert_project_in_org();
CREATE TRIGGER milestones_same_org BEFORE INSERT OR UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION assert_project_in_org();
CREATE TRIGGER scope_changes_same_org BEFORE INSERT OR UPDATE ON scope_changes
  FOR EACH ROW EXECUTE FUNCTION assert_project_in_org();
CREATE TRIGGER comments_same_org BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION assert_project_in_org();
CREATE TRIGGER activity_events_same_org BEFORE INSERT ON activity_events
  FOR EACH ROW EXECUTE FUNCTION assert_project_in_org();
CREATE TRIGGER scope_change_revisions_same_org BEFORE INSERT ON scope_change_revisions
  FOR EACH ROW EXECUTE FUNCTION assert_scope_change_in_org();
CREATE TRIGGER scope_change_decisions_same_org BEFORE INSERT ON scope_change_decisions
  FOR EACH ROW EXECUTE FUNCTION assert_scope_change_in_org();

-- System-only tables -------------------------------------------------------------
REVOKE ALL ON processed_stripe_events FROM scopeflow_app;
DO $$ BEGIN
  IF to_regclass('_prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON _prisma_migrations FROM scopeflow_app;
  END IF;
END $$;
