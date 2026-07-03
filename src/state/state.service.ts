import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { AppConfigService } from '../config/app-config.service';

const MAX_PROCESSED_IDS = 500;

@Injectable()
export class StateService implements OnModuleInit {
  private processedIds: number[] = [];

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    mkdirSync(dirname(this.config.stateFilePath), { recursive: true });
    if (existsSync(this.config.stateFilePath)) {
      const raw = readFileSync(this.config.stateFilePath, 'utf-8');
      this.processedIds = JSON.parse(raw).processedIds ?? [];
    }
  }

  isProcessed(id: number): boolean {
    return this.processedIds.includes(id);
  }

  markProcessed(id: number): void {
    if (this.isProcessed(id)) return;
    this.processedIds.push(id);
    if (this.processedIds.length > MAX_PROCESSED_IDS) {
      this.processedIds = this.processedIds.slice(-MAX_PROCESSED_IDS);
    }
    writeFileSync(this.config.stateFilePath, JSON.stringify({ processedIds: this.processedIds }), 'utf-8');
  }
}
