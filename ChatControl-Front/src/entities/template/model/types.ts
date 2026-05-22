export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  createdAt?: number;
  updatedAt?: number;
  language?: string;
}
