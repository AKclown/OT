import { Module } from '@nestjs/common';
import { OtService } from './ot.service';
import { OtGateway } from './ot.gateway';

@Module({
  providers: [OtGateway, OtService],
})
export class OtModule {}
