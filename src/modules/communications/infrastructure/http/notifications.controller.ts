import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateNotificationsUseCase } from '../../application/notifications/create-notifications.use-case.js';
import { ListMyNotificationsUseCase } from '../../application/notifications/list-my-notifications.use-case.js';
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../application/notifications/mark-notification-read.use-case.js';
import { CreateNotificationsDto, MyNotificationsQueryDto } from './dto/notifications.dto.js';

/** In-app notifications. Every authenticated user manages only their own. */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly list: ListMyNotificationsUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase,
    private readonly create: CreateNotificationsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mis notificaciones (con total de no leídas)' })
  mine(@CurrentActor() actor: AuthenticatedActor, @Query() query: MyNotificationsQueryDto) {
    return this.list.execute({
      userId: actor.userId,
      unreadOnly: query.unreadOnly ?? false,
      page: query.toPageRequest(),
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todas mis notificaciones como leídas' })
  readAll(@CurrentActor() actor: AuthenticatedActor) {
    return this.markAllRead.execute(actor.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca una de mis notificaciones como leída' })
  read(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.markRead.execute({ userId: actor.userId, notificationId: id });
  }

  @Post()
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE)
  @ApiOperation({ summary: 'Envía una notificación interna a uno o varios usuarios' })
  send(@Body() dto: CreateNotificationsDto) {
    return this.create.execute({ userIds: dto.userIds, title: dto.title, message: dto.message, type: dto.type });
  }
}
