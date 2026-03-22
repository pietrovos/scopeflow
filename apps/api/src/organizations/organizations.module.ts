import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { MembersService } from './members.service.js';
import { INVITATION_LISTENER, InvitationsService, type InvitationCreatedEvent } from './invitations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    MembersService,
    InvitationsService,
    {
      provide: INVITATION_LISTENER,
      inject: [NotificationsService],
      useFactory: (n: NotificationsService) => (e: InvitationCreatedEvent) => n.invitationCreated(e),
    },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
