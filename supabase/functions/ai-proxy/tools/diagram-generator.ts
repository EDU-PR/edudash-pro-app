/**
 * Diagram Generator Tool
 * 
 * Generates diagrams, charts, and visual aids for exam questions.
 */

import type { ToolExecutionResult } from '../types.ts'
import type { ToolContext } from './tool-registry.ts'

/**
 * Execute diagram generation tool
 */
export async function executeDiagramGenerator(
  input: Record<string, any>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  console.log('[ai-proxy] Executing generate_diagram tool with input:', JSON.stringify(input, null, 2))
  
  try {
    const { type, data, title, caption } = input
    
    // Validate input
    if (!type || !data) {
      return {
        success: false,
        error: 'Missing required fields: type and data'
      }
    }
    
    // Validate diagram type
    const validTypes = ['chart', 'mermaid', 'svg']
    if (!validTypes.includes(type)) {
      return {
        success: false,
        error: `Invalid diagram type "${type}". Must be one of: ${validTypes.join(', ')}`
      }
    }
    
    // Prepare diagram data based on type
    let diagramData: any
    
    if (type === 'chart') {
      const chartResult = validateChartData(data)
      if (!chartResult.valid) {
        return {
          success: false,
          error: chartResult.error
        }
      }
      
      diagramData = {
        type: 'chart',
        chartType: data.chartType,
        data: data.data,
        xKey: data.xKey || 'name',
        yKey: data.yKey || 'value',
        title: title || '',
        caption: caption || ''
      }
    } else if (type === 'mermaid') {
      const mermaidResult = validateMermaidData(data)
      if (!mermaidResult.valid) {
        return {
          success: false,
          error: mermaidResult.error
        }
      }
      
      diagramData = {
        type: 'mermaid',
        code: data.mermaidCode,
        title: title || '',
        caption: caption || ''
      }
    } else if (type === 'svg') {
      const svgResult = validateSVGData(data)
      if (!svgResult.valid) {
        return {
          success: false,
          error: svgResult.error
        }
      }
      
      diagramData = {
        type: 'svg',
        content: data.svg,
        title: title || '',
        caption: caption || ''
      }
    }
    
    console.log(`[ai-proxy] Generated ${type} diagram successfully`)
    
    return {
      success: true,
      result: diagramData
    }
  } catch (error: any) {
    console.error('[ai-proxy] Diagram generation error:', error)
    return {
      success: false,
      error: `Diagram generation failed: ${error.message}`
    }
  }
}

/**
 * Validate chart data structure
 */
export function validateChartData(data: any): { valid: boolean; error?: string } {
  if (!data.chartType) {
    return { valid: false, error: 'Chart requires chartType field' }
  }
  
  const validChartTypes = ['bar', 'line', 'pie']
  if (!validChartTypes.includes(data.chartType)) {
    return {
      valid: false,
      error: `Invalid chartType "${data.chartType}". Must be one of: ${validChartTypes.join(', ')}`
    }
  }
  
  if (!Array.isArray(data.data)) {
    return { valid: false, error: 'Chart data must be an array' }
  }
  
  if (data.data.length === 0) {
    return { valid: false, error: 'Chart data array cannot be empty' }
  }
  
  // Validate each data point has required fields
  for (let i = 0; i < data.data.length; i++) {
    const point = data.data[i]
    
    if (!point.name && !point.label) {
      return {
        valid: false,
        error: `Data point ${i + 1} is missing "name" or "label" field`
      }
    }
    
    if (typeof point.value !== 'number') {
      return {
        valid: false,
        error: `Data point ${i + 1} has invalid "value" field (must be a number)`
      }
    }
  }
  
  return { valid: true }
}

/**
 * Validate Mermaid diagram data
 */
export function validateMermaidData(data: any): { valid: boolean; error?: string } {
  if (!data.mermaidCode || typeof data.mermaidCode !== 'string') {
    return { valid: false, error: 'Mermaid diagram requires mermaidCode string' }
  }
  
  const code = data.mermaidCode.trim()
  
  if (code.length === 0) {
    return { valid: false, error: 'Mermaid code cannot be empty' }
  }
  
  // Basic syntax validation - check for common Mermaid diagram types
  const validStarters = [
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'graph'
  ]
  
  const hasValidStarter = validStarters.some(starter => 
    code.toLowerCase().startsWith(starter.toLowerCase())
  )
  
  if (!hasValidStarter) {
    return {
      valid: false,
      error: `Mermaid code must start with a valid diagram type: ${validStarters.join(', ')}`
    }
  }
  
  return { valid: true }
}

/**
 * Validate SVG data
 */
export function validateSVGData(data: any): { valid: boolean; error?: string } {
  if (!data.svg || typeof data.svg !== 'string') {
    return { valid: false, error: 'SVG diagram requires svg string' }
  }
  
  const svg = data.svg.trim()
  
  if (svg.length === 0) {
    return { valid: false, error: 'SVG content cannot be empty' }
  }
  
  // Basic validation - check for <svg> tags
  if (!svg.includes('<svg') || !svg.includes('</svg>')) {
    return { valid: false, error: 'SVG content must include <svg> and </svg> tags' }
  }
  
  return { valid: true }
}

/**
 * Create a sample bar chart
 */
export function createSampleBarChart(title: string, dataPoints: Array<{ name: string; value: number }>): any {
  return {
    type: 'chart',
    chartType: 'bar',
    data: dataPoints,
    xKey: 'name',
    yKey: 'value',
    title,
    caption: ''
  }
}

/**
 * Create a sample line chart
 */
export function createSampleLineChart(title: string, dataPoints: Array<{ name: string; value: number }>): any {
  return {
    type: 'chart',
    chartType: 'line',
    data: dataPoints,
    xKey: 'name',
    yKey: 'value',
    title,
    caption: ''
  }
}

/**
 * Create a sample pie chart
 */
export function createSamplePieChart(title: string, dataPoints: Array<{ name: string; value: number }>): any {
  return {
    type: 'chart',
    chartType: 'pie',
    data: dataPoints,
    xKey: 'name',
    yKey: 'value',
    title,
    caption: ''
  }
}

/**
 * Create a sample Mermaid flowchart
 */
export function createSampleFlowchart(title: string, code: string): any {
  return {
    type: 'mermaid',
    code,
    title,
    caption: ''
  }
}
