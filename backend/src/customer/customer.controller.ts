import {
  Controller, Get, Post, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerService } from './customer.service';
import {
  VerifyFirebaseTokenDto,
  CreateCustomerOrderDto,
  AddCustomerItemsDto,
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto,
} from './dto/customer.dto';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ─── Auth (public) ────────────────────────────────────────────────────────

  @Post('auth/verify-firebase')
  verifyFirebase(@Body() dto: VerifyFirebaseTokenDto) {
    return this.customerService.verifyFirebaseToken(dto.idToken, dto.name);
  }

  // ─── Menu (public) ────────────────────────────────────────────────────────

  @Get('menu')
  getMenu() {
    return this.customerService.getMenu();
  }

  @Get('table/:tableId')
  getTableSession(@Param('tableId') tableId: string) {
    return this.customerService.getTableSession(tableId);
  }

  // ─── Orders (customer JWT required) ─────────────────────────────────────

  @UseGuards(AuthGuard('customer-jwt'))
  @Post('orders')
  createOrder(@Req() req: any, @Body() dto: CreateCustomerOrderDto) {
    return this.customerService.getOrCreateOrder(req.user.id, dto.tableId);
  }

  @UseGuards(AuthGuard('customer-jwt'))
  @Post('orders/:id/items')
  addItems(@Req() req: any, @Param('id') id: string, @Body() dto: AddCustomerItemsDto) {
    return this.customerService.addItems(req.user.id, id, dto.items);
  }

  @UseGuards(AuthGuard('customer-jwt'))
  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.customerService.getOrder(id);
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('customer-jwt'))
  @Post('payments/create')
  createPayment(@Body() dto: CreateRazorpayOrderDto) {
    return this.customerService.createRazorpayOrder(dto.orderId);
  }

  @Post('payments/verify')
  verifyPayment(@Body() dto: VerifyRazorpayPaymentDto) {
    return this.customerService.verifyRazorpayPayment(
      dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature, dto.orderId,
    );
  }
}
