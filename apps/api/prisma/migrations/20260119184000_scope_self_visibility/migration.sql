-- A user may see their own memberships (and those orgs) across every organization,
-- but only in user-scoped context (no app.org_id). Inside an org, queries now see
-- that org alone, so a missing `where: { orgId }` cannot pull in rows from the
-- caller's other organizations.

DROP POLICY membership_select ON memberships;
CREATE POLICY membership_select ON memberships FOR SELECT USING (
  CASE
    WHEN app_org_id() IS NULL THEN user_id = app_user_id()
    ELSE org_id = app_org_id() AND (app_is_staff() OR user_id = app_user_id())
  END
);

DROP POLICY org_select ON organizations;
CREATE POLICY org_select ON organizations FOR SELECT USING (
  CASE
    WHEN app_org_id() IS NULL THEN EXISTS (
      SELECT 1 FROM memberships m WHERE m.org_id = organizations.id AND m.user_id = app_user_id()
    )
    ELSE id = app_org_id()
  END
);
