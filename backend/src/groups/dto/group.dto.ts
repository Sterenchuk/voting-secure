import { Prisma } from '@prisma/client';
import { GROUP_SELECT_FIELDS } from 'src/common/constants/group.select.fields';

export type GroupDto = Prisma.GroupGetPayload<{
  select: typeof GROUP_SELECT_FIELDS;
}>;
