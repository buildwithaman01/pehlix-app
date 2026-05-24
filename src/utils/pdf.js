import { Client } from '@upstash/qstash';
import { config } from '../config/index.js';
import Report from '../modules/reports/report.model.js';
import { AppError } from './errors.js';

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

// Define endpoints list from environment variables
const getNodes = () => {
  const nodes = [
    process.env.RENDER_PDF_ENDPOINT,
    process.env.GCP_PDF_ENDPOINT,
    process.env.RAILWAY_PDF_ENDPOINT
  ].map(node => node ? node.trim() : null)
   .filter(node => node && 
                   node !== 'PLACEHOLDER_RENDER_URL' && 
                   node !== 'PLACEHOLDER_GCP_URL' && 
                   node !== 'PLACEHOLDER_RAILWAY_URL' &&
                   !node.includes('PLACEHOLDER'));
  return nodes;
};

export const PdfService = {
  /**
   * Returns list of configured nodes.
   */
  getAvailableNodes() {
    return getNodes();
  },

  /**
   * Selects a random node excluding specified ones.
   */
  selectNode(excludeNodes = []) {
    const nodes = this.getAvailableNodes();
    const cleanExcludes = excludeNodes.map(n => n.trim().toLowerCase());
    
    const remainingNodes = nodes.filter(node => {
      const nodeLower = node.toLowerCase();
      return !cleanExcludes.some(ex => 
        nodeLower.includes(ex) || ex.includes(nodeLower)
      );
    });

    if (remainingNodes.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * remainingNodes.length);
    return remainingNodes[randomIndex];
  },

  /**
   * Calculates the complexity score of a visit (kept for analytics).
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
   * Publishes QStash job to generate PDF.
   */
  async enqueuePdfJob(visitId, labId, reportId) {
    const node = this.selectNode();
    if (!node) {
      console.error(`[PdfService] Failed to enqueue: No PDF nodes available`);
      throw new AppError('No available PDF node configured', 'PDF_GENERATION_FAILED', 500);
    }

    const payload = {
      visitId: visitId.toString(),
      labId: labId.toString(),
      reportId: reportId.toString(),
      requestedAt: new Date().toISOString()
    };

    console.log(`[PdfService] Enqueuing PDF job for report ${reportId} to endpoint: ${node}`);

    const failureCallback = `${config.NEXT_PUBLIC_APP_URL}/api/internal/pdf/failed`;

    // Publish to QStash (90s timeout)
    const res = await qstashPublishJSON({
      url: node,
      body: payload,
      headers: {
        'Authorization': `Bearer ${config.PDF_SERVICE_SECRET || process.env.PDF_SERVICE_SECRET}`
      },
      retries: 3,
      timeout: 90,
      failureCallback
    });

    // Update report record
    await Report.findByIdAndUpdate(reportId, {
      status: 'generating',
      selectedNode: node,
      qstashMessageId: res.messageId
    });

    return { messageId: res.messageId, node };
  },

  /**
   * Called when a node fails. Selects the next node and re-publishes.
   */
  async requeueToNextNode(reportId, failedNode) {
    const report = await Report.findById(reportId);
    if (!report) {
      console.error(`[PdfService] Requeue failed: Report ${reportId} not found in database`);
      return null;
    }

    const failedNodes = report.failedNodes || [];
    if (failedNode && !failedNodes.includes(failedNode)) {
      failedNodes.push(failedNode);
    }

    const nextNode = this.selectNode(failedNodes);
    if (!nextNode) {
      console.warn(`[PdfService] Requeue failed for report ${reportId}: No other fallback nodes available.`);
      report.status = 'failed';
      report.failedNodes = failedNodes;
      await report.save();
      return null;
    }

    const payload = {
      visitId: report.visitId.toString(),
      labId: report.labId.toString(),
      reportId: report._id.toString(),
      requestedAt: new Date().toISOString()
    };

    console.log(`[PdfService] Node failed: ${failedNode}. Re-queuing report ${reportId} to next node: ${nextNode}`);

    const failureCallback = `${config.NEXT_PUBLIC_APP_URL}/api/internal/pdf/failed`;

    const res = await qstashPublishJSON({
      url: nextNode,
      body: payload,
      headers: {
        'Authorization': `Bearer ${config.PDF_SERVICE_SECRET || process.env.PDF_SERVICE_SECRET}`
      },
      retries: 3,
      timeout: 90,
      failureCallback
    });

    report.selectedNode = nextNode;
    report.failedNodes = failedNodes;
    report.qstashMessageId = res.messageId;
    await report.save();

    return { messageId: res.messageId, node: nextNode };
  }
};

export default PdfService;
