import 'socket.io';
import { User } from '../users/user.entity'; // adjust path if needed

declare module 'socket.io' {
  interface Handshake {
    user?: User;
  }
}
