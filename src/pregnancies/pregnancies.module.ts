import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PregnancyCalculationService } from './pregnancy-calculation.service';
import { PregnanciesController } from './pregnancies.controller';
import { PregnanciesService } from './pregnancies.service';

@Module({
  imports: [AuthModule],
  controllers: [PregnanciesController],
  providers: [PregnanciesService, PregnancyCalculationService],
  exports: [PregnanciesService, PregnancyCalculationService],
})
export class PregnanciesModule {}
