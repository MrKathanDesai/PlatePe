import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  SplitBillDto,
} from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.confirm(id, dto, user);
  }

  @Post(':id/refund')
  refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.refund(id, dto, user);
  }

  @Get('order/:orderId')
  getByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.getByOrder(orderId);
  }

  @Post('order/:orderId/split')
  calculateSplit(@Param('orderId') orderId: string, @Body() dto: SplitBillDto) {
    return this.paymentsService.calculateSplit(orderId, dto);
  }

  // UPI webhook — no JWT (called by payment gateway)
  @Post('upi-webhook')
  upiWebhook(@Body() body: { upiRef: string; status: 'CONFIRMED' | 'FAILED' }) {
    return this.paymentsService.handleUpiWebhook(body.upiRef, body.status);
  }
}
