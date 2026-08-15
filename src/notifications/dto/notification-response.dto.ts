import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationItemResponseDto {
  @ApiProperty({ example: 15 })
  id!: number;

  @ApiProperty({ example: 'طلب إعانة جديد' })
  title!: string;

  @ApiProperty({ example: 'تم إنشاء طلب إعانة جديد وبانتظار المراجعة.' })
  message!: string;

  @ApiPropertyOptional({ example: 'AID_REQUEST_REVIEW', nullable: true })
  targetType!: string | null;

  @ApiPropertyOptional({ example: 7, nullable: true })
  targetId!: number | null;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ example: '2026-08-15T09:30:00.000Z' })
  createdAt!: Date;
}

export class NotificationListMetaDto {
  @ApiProperty({ example: 35 })
  totalCount!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 2 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationItemResponseDto] })
  data!: NotificationItemResponseDto[];

  @ApiProperty({ type: NotificationListMetaDto })
  meta!: NotificationListMetaDto;

  @ApiProperty({ example: 4 })
  unreadCount!: number;
}

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ example: 4 })
  unreadCount!: number;
}

export class MarkNotificationReadResponseDto {
  @ApiProperty({ example: 15 })
  id!: number;

  @ApiProperty({ example: true })
  isRead!: true;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 4 })
  updatedCount!: number;
}
