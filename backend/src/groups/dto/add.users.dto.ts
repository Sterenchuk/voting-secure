import { IsArray, IsEmail } from 'class-validator';

export class AddUsersDto {
  @IsArray()
  @IsEmail(
    {},
    { each: true, message: 'Each user email must be a valid email address.' },
  )
  userEmails: string[];
}
