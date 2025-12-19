import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { MembersService } from './members.service.js';
import { INVITATION_LISTENER, InvitationsService } from './invitations.service.js';

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    MembersService,
    InvitationsService,
    // Replaced by the email notifier in the notifications module.
    { provide: INVITATION_LISTENER, useValue: () => undefined },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
