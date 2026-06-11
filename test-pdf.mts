import { config } from 'dotenv';
config();
import { generateCompliancePdf } from './server/pdfExport.ts';

const check = {
  id: 1, userId: null, imageUrl: '/test', imageKey: 'test', fileName: 'test.png',
  imageBase64: null, imageMimeType: null,
  extractedText: 'テストテキスト',
  overallRisk: 'high' as const, totalViolations: 1, summary: 'テスト審査サマリー',
  createdAt: new Date(),
};
const items = [{
  id: 1, checkId: 1, category: 'yakujiho' as const, riskLevel: 'high' as const,
  violationText: '問題表現', reason: '理由', suggestion: '改善提案',
  legalBasis: '薬機法第66条', createdAt: new Date(),
}];

try {
  const bytes = await generateCompliancePdf(check, items);
  console.log('PDF OK, size:', bytes.length, 'bytes');
} catch (e: any) {
  console.error('PDF error:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
}
