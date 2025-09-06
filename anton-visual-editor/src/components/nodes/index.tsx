'use client'

import BaseNode from './BaseNode'
import ReviewNode from './ReviewNode'
import { NodeProps } from '@xyflow/react'

const categoryColors = {
  setup: '#3B82F6',
  execution: '#10B981',
  testing: '#F59E0B',
  integration: '#8B5CF6',
  review: '#EC4899',
  summary: '#6B7280',
}

export const SetupNode = (props: NodeProps) => (
  <BaseNode {...props} categoryColor={categoryColors.setup} />
)

export const ExecutionNode = (props: NodeProps) => (
  <BaseNode {...props} categoryColor={categoryColors.execution} />
)

export const TestingNode = (props: NodeProps) => (
  <BaseNode {...props} categoryColor={categoryColors.testing} />
)

export const IntegrationNode = (props: NodeProps) => (
  <BaseNode {...props} categoryColor={categoryColors.integration} />
)

// Use specialized ReviewNode component for review nodes
export { ReviewNode }

export const SummaryNode = (props: NodeProps) => (
  <BaseNode {...props} categoryColor={categoryColors.summary} />
)

export const nodeTypes = {
  setup: SetupNode,
  execution: ExecutionNode,
  testing: TestingNode,
  integration: IntegrationNode,
  review: ReviewNode,
  summary: SummaryNode,
}