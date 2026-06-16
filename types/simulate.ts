export interface CustomerTrace {
  customerId:  string;
  outcome:     'PASS' | 'SUPPRESSED' | 'NO_MATCH';
  gate:        string;
  reason:      string;
  actionId?:   string;
  actionName?: string;
  attributes:  Record<string, unknown>;
}
