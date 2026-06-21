import { Role } from '../../common/enums/role';

export interface VotingUser {
  sub: string;
  email: string;
  name: string;
  role: Role;
  language: string;
  theme: string;
}

export interface Selections {
  optionIds: string[];
  otherText?: string;
  isAbstention?: boolean;
}
