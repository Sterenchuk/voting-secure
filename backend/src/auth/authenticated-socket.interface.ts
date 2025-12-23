import { Socket } from 'socket.io';
import { UserDto } from 'src/users/dto/user.dto';

export interface AuthenticatedSocket extends Socket {
  user: UserDto;
}
