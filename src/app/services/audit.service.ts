import { Injectable } from '@angular/core';

export type AuditEntityType = 'product' | 'category';

export interface AuditEvent {
  entityType: AuditEntityType;
  entityName: string;
  actor: string;
  details?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private readonly storageKey = 'tpv_audit_events';

  recordCreated(entityType: AuditEntityType, entityName: string, actor: string, details?: string): void {
    const event: AuditEvent = {
      entityType,
      entityName,
      actor,
      details,
      createdAt: new Date().toISOString(),
    };

    const events = this.readEvents();
    events.unshift(event);
    this.writeEvents(events.slice(0, 100));
  }

  getEvents(entityType?: AuditEntityType): AuditEvent[] {
    const events = this.readEvents();
    return entityType ? events.filter((event) => event.entityType === entityType) : events;
  }

  private readEvents(): AuditEvent[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeEvents(events: AuditEvent[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(events));
    } catch {
      // Ignoramos fallos de almacenamiento para no bloquear la UI.
    }
  }
}