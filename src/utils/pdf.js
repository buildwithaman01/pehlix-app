import { Client } from '@upstash/qstash';
import { config } from '../config/index.js';

// Initialize QStash Client
const qstashClient = new Client({
  token: config.UPSTASH_QSTASH_TOKEN,
  baseUrl: config.UPSTASH_QSTASH_URL
});

const qstashPublishJSON = async (options) => {
  const url = options.url || '';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1');
  const isPlaceholderToken = !config.UPSTASH_QSTASH_TOKEN || config.UPSTASH_QSTASH_TOKEN.startsWith('PLACEHOLDER');
  
  if (process.env.NODE_ENV === 'test' || isLocalhost || isPlaceholderToken) {
    console.log(`[MOCK QSTASH PDF] Published PDF job to: ${url}`);
    return { messageId: `mock-pdf-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
  }
  return await qstashClient.publishJSON(options);
};

export const PdfService = {
  /**
   * Calculates the complexity score of a visit.
   * Score formula:
   *  - Number of tests * 5
   *  - Plus number of total parameters across all tests
   *  - Plus 20 if trend data exists for any test
   *  - Plus 30 if NABL format required
   */
  calculateComplexityScore(visit) {
    const tests = visit.tests || [];
    const testsCount = tests.length;
    let parametersCount = 0;
    let trendExists = false;

    tests.forEach(test => {
      if (test.parameters && Array.isArray(test.parameters)) {
        parametersCount += test.parameters.length;
      } else if (test.parameterCount) {
        parametersCount += test.parameterCount;
      }
      if (test.hasTrend || test.hasTrendData) {
        trendExists = true;
      }
    });

    if (visit.hasTrend || visit.hasTrendData) {
      trendExists = true;
    }

    const nablRequired = !!(visit.nablRequired || visit.isNabl || (visit.labId && visit.labId.nablNumber));

    let score = (testsCount * 5) + parametersCount;
    if (trendExists) score += 20;
    if (nablRequired) score += 30;

    return score;
  },

  /**
   * Selects the correct endpoint based on complexity score.
   */
  selectPdfNode(complexityScore) {
    if (complexityScore < 20) {
      return process.env.FLYIO_PDF_ENDPOINT || 'https://pehlix-pdf.fly.dev/generate';
    } else if (complexityScore <= 50) {
      return process.env.GCP_PDF_ENDPOINT || 'https://pehlix-gcp-pdf.pehlix.in/generate';
    } else {
      return process.env.ORACLE_PDF_ENDPOINT || 'https://pehlix-oracle-pdf.pehlix.in/generate';
    }
  },

  /**
   * Publishes QStash job to generate PDF.
   */
  async enqueuePdfJob(visitId, labId, reportId, complexityScore) {
    const endpoint = this.selectPdfNode(complexityScore);
    const payload = {
      visitId: visitId.toString(),
      labId: labId.toString(),
      reportId: reportId.toString(),
      requestedAt: new Date().toISOString()
    };

    console.log(`[PdfService] Enqueuing PDF job for report ${reportId} to endpoint: ${endpoint} (Score: ${complexityScore})`);

    const failureCallback = `${config.NEXT_PUBLIC_APP_URL}/api/internal/pdf/failed`;

    // Publish to QStash
    const res = await qstashPublishJSON({
      url: endpoint,
      body: payload,
      headers: {
        'Authorization': `Bearer ${config.PDF_SERVICE_SECRET || process.env.PDF_SERVICE_SECRET}`
      },
      retries: 3,
      failureCallback
    });

    return res.messageId;
  },

  /**
   * Called when a node fails. Selects the next node and re-publishes.
   */
  async requeueToNextNode(visitId, labId, reportId, failedEndpoint) {
    const allNodes = [
      process.env.FLYIO_PDF_ENDPOINT || 'https://pehlix-pdf.fly.dev/generate',
      process.env.GCP_PDF_ENDPOINT || 'https://pehlix-gcp-pdf.pehlix.in/generate',
      process.env.ORACLE_PDF_ENDPOINT || 'https://pehlix-oracle-pdf.pehlix.in/generate'
    ];

    const uniqueNodes = [...new Set(allNodes)].filter(Boolean);
    const failedClean = failedEndpoint.trim().toLowerCase();

    // Filter out the failed endpoint
    const remainingNodes = uniqueNodes.filter(node => 
      !node.toLowerCase().includes(failedClean) && 
      !failedClean.includes(node.toLowerCase())
    );

    if (remainingNodes.length === 0) {
      console.error(`[PdfService] Requeue failed: No other fallback nodes available.`);
      throw new Error('No fallback nodes available');
    }

    const nextNode = remainingNodes[0];
    const payload = {
      visitId: visitId.toString(),
      labId: labId.toString(),
      reportId: reportId.toString(),
      requestedAt: new Date().toISOString()
    };

    console.log(`[PdfService] Node failed: ${failedEndpoint}. Re-queuing report ${reportId} to next node: ${nextNode}`);

    const failureCallback = `${config.NEXT_PUBLIC_APP_URL}/api/internal/pdf/failed`;

    const res = await qstashPublishJSON({
      url: nextNode,
      body: payload,
      headers: {
        'Authorization': `Bearer ${config.PDF_SERVICE_SECRET || process.env.PDF_SERVICE_SECRET}`
      },
      retries: 3,
      failureCallback
    });

    return res.messageId;
  }
};

export default PdfService;
