import { IsString, IsNotEmpty, IsArray, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ type: String, example: 'Suggest a fast-paced sci-fi novel about AI', description: 'The user chat message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message;

  @ApiProperty({ type: Array, required: false, description: 'Prior conversation turns [{role, content}]' })
  @IsArray()
  @IsOptional()
  history;

  @ApiProperty({ type: Number, required: false, default: 5, minimum: 1, maximum: 20, description: 'Number of book recommendations' })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  limit;
}
