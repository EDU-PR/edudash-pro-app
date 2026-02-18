import { registerCommunicationTools } from '@/services/modules/tools/CommunicationTools';
import type { AgentTool } from '@/services/modules/DashToolRegistry';

function getGenerateChartTool(): AgentTool {
  const tools: AgentTool[] = [];
  registerCommunicationTools((tool) => tools.push(tool));
  const chartTool = tools.find((tool) => tool.name === 'generate_chart');
  if (!chartTool) {
    throw new Error('generate_chart tool not registered');
  }
  return chartTool;
}

describe('generate_chart guardrails', () => {
  it('rejects mismatched labels and values lengths', async () => {
    const chartTool = getGenerateChartTool();
    const result = await chartTool.execute({
      title: 'Term marks',
      chart_type: 'bar',
      labels: ['Term 1', 'Term 2'],
      values: [88],
    });

    expect(result.success).toBe(false);
    expect(String(result.error || '')).toMatch(/same length/i);
  });

  it('rejects unsupported chart types', async () => {
    const chartTool = getGenerateChartTool();
    const result = await chartTool.execute({
      title: 'Attendance',
      chart_type: 'scatter',
      labels: ['Week 1'],
      values: [92],
    });

    expect(result.success).toBe(false);
    expect(String(result.error || '')).toMatch(/chart_type/i);
  });
});
