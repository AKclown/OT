import { PartialType } from '@nestjs/mapped-types';
import { CreateOtDto } from './create-ot.dto';

export class UpdateOtDto extends PartialType(CreateOtDto) {
  id: number;
}
