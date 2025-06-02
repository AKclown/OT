import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OtModule } from './ot/ot.module';

@Module({
  imports: [OtModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
