import { SetMetadata } from '@nestjs/common';

export const STRICT_GROUP_CHECK_KEY = 'strictGroupCheck';
export const StrictGroupCheck = () => SetMetadata(STRICT_GROUP_CHECK_KEY, true);
