import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditVerifyGuard } from './audit-verify.guard';
import { VerifyResult } from './types/audit.types';
import { InjectModel } from '@nestjs/mongoose';
import { AuditChain } from './schemas/audit-chain.schema';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    @InjectModel(AuditChain.name)
    private readonly chainModel: Model<AuditChain>,
  ) {}

  @Get()
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 20,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const filter: any = {};
    if (entityType === 'voting') filter.votingId = entityId;
    if (entityType === 'survey') filter.surveyId = entityId;
    if (entityType === 'group') filter.groupId = entityId;
    if (entityType === 'user') filter.userId = entityId;

    const [records, totalCount] = await Promise.all([
      this.chainModel
        .find(filter)
        .sort({ sequence: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.chainModel.countDocuments(filter),
    ]);

    return {
      records,
      totalCount,
      page,
      pageSize,
    };
  }

  @Get('hash/:hash')
  async findByHash(@Param('hash') hash: string) {
    const record = await this.chainModel.findOne({ hash }).lean().exec();
    return { record };
  }

  @Get('verify')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  async verifyFullChain(): Promise<VerifyResult> {
    return this.auditService.verifyChain();
  }

  @Get('verify/:groupId')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  async verifyGroupChain(
    @Param('groupId') groupId: string,
  ): Promise<VerifyResult> {
    return this.auditService.verifyChain(groupId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const record = await this.chainModel.findById(id).lean().exec();
    return { record };
  }
}
