import { User } from '@prisma/client';

export type AuthRequest = Request & { user: Pick<User, 'id'> };
