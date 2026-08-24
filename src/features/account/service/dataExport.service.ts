// src/features/account/service/dataExport.service.ts
//
// "Download my data" — the counterpart to account deletion, required by the
// Play Store data policy and India's DPDP Act.
//
// Delivery is by email rather than by file download. The backend also serves
// the export as a streamed JSON file at GET /user/export-data, but this app has
// no filesystem library, so a download it cannot save would be a feature the
// user can see and not use. Emailing it to the registered address is also what
// every large platform does, and it puts the file somewhere the user already
// controls.

import { api } from '../../../utils/api';
import { ApiResponse } from '../../../types/auth.types';

export interface DataExportResponse {
  /** Partially masked, so the user can confirm the destination. */
  sentTo: string;
  sizeBytes: number;
  counts: Record<string, number>;
}

export const dataExportService = {
  /**
   * Generate the export and email it to the account's verified address.
   *
   * The server rejects this with 403 when the email is unverified — the export
   * is a complete dump of personal data, so it may only go to an address the
   * user has proven they control.
   */
  emailExport: async () => {
    const response = await api.post<ApiResponse<DataExportResponse>>(
      'user/export-data/email',
    );
    return response.data;
  },
};
