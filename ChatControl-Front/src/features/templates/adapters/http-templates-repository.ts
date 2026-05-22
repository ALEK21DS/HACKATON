import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplatesFromMeta,
  getTemplatesList,
  updateTemplate,
} from '@/shared/api/chatcontrol/client';
import type { TemplatesRepository } from '../ports/templates-repository';

export const httpTemplatesRepository: TemplatesRepository = {
  getTemplatesFromMeta,
  getTemplatesList,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
