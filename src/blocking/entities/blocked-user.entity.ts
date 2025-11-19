import { BlockedUser } from '@prisma/client';

export class BlockedUserEntity {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: Date;

  constructor(partial: BlockedUser) {
    Object.assign(this, partial);
  }
}
