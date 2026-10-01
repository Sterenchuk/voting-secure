import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';

export class SignTokenDto {
  @IsString()
  token: string; // T — сирий секретний токен (сервер обчислює tokenHash = HMAC-SHA256(T))

  @IsString()
  blinded: string; // T · r^e (mod n)

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  optionIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  otherText?: string;

  @IsOptional()
  @IsBoolean()
  isAbstention?: boolean;

  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;
}
