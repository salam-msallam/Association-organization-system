import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { CaslModule } from '../casl/casl.module'; 
import { AuthModule } from 'src/auth/auth.module';


@Module({
  imports:[
    CaslModule,
    AuthModule,
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
