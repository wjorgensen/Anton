#!/usr/bin/env ts-node

import { FlowPlanningService } from './src/index';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function testPlanningService() {
  console.log('🚀 Testing Flow Planning Service\n');
  console.log('=' . repeat(50));

  const planner = new FlowPlanningService();

  const testCases = [
    {
      name: 'Next.js E-commerce Platform',
      description: 'Build a full-stack e-commerce platform with Next.js, featuring user authentication, product catalog, shopping cart, payment integration with Stripe, and comprehensive testing. Use PostgreSQL for the database and implement both unit and e2e tests.'
    },
    {
      name: 'Python Microservice API',
      description: 'Create a FastAPI microservice for data processing with PostgreSQL database, Redis caching, comprehensive pytest testing, Docker containerization, and API documentation. Include authentication and rate limiting.'
    },
    {
      name: 'React Dashboard Application',
      description: 'Develop a React admin dashboard with data visualization, user management, real-time updates via WebSocket, REST API integration, and Cypress e2e testing. Focus on responsive design and performance optimization.'
    },
    {
      name: 'Mobile Flutter App',
      description: 'Build a cross-platform mobile application using Flutter with user authentication, offline support, push notifications, and API integration. Include comprehensive testing and deployment setup.'
    },
    {
      name: 'Simple REST API',
      description: 'Create a simple REST API with Node.js and Express for managing todos with basic CRUD operations and Jest unit tests.'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test Case: ${testCase.name}`);
    console.log('-'.repeat(50));
    console.log(`Description: ${testCase.description}\n`);

    try {
      const result = await planner.planFlow(testCase.description);
      
      console.log('\n📊 Planning Results:');
      console.log(`✅ Valid: ${result.validation.valid}`);
      console.log(`📈 Metrics:`);
      console.log(`  • Total Nodes: ${result.metrics.totalNodes}`);
      console.log(`  • Total Edges: ${result.metrics.totalEdges}`);
      console.log(`  • Max Parallelism: ${result.metrics.maxParallelism}`);
      console.log(`  • Estimated Time: ${result.metrics.estimatedTime} minutes`);
      console.log(`  • Estimated Tokens: ${result.metrics.estimatedTokens.toLocaleString()}`);
      console.log(`  • Critical Path Length: ${result.metrics.criticalPathLength} minutes`);
      
      if (result.validation.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.validation.errors.forEach(error => console.log(`  • ${error}`));
      }
      
      if (result.validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.validation.warnings.forEach(warning => console.log(`  • ${warning}`));
      }
      
      if (result.validation.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        result.validation.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
      }
      
      console.log('\n🔗 Flow Structure:');
      console.log(`  Layers:`);
      result.graph.layers.forEach((layer, index) => {
        const layerNodes = layer.map(nodeId => {
          const node = result.flow.nodes.find(n => n.id === nodeId);
          return node ? node.agentId : nodeId;
        });
        console.log(`    Layer ${index + 1}: ${layerNodes.join(', ')}`);
      });
      
      console.log(`\n  Critical Path: ${result.graph.criticalPath.map(nodeId => {
        const node = result.flow.nodes.find(n => n.id === nodeId);
        return node ? node.agentId : nodeId;
      }).join(' → ')}`);
      
      const filename = `flow-${testCase.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      const outputPath = join(__dirname, 'output', filename);
      writeFileSync(outputPath, JSON.stringify(result.flow, null, 2));
      console.log(`\n💾 Flow saved to: output/${filename}`);
      
    } catch (error) {
      console.error(`\n❌ Error planning flow: ${error}`);
    }
    
    console.log('\n' + '='.repeat(50));
  }

  console.log('\n\n🎯 Advanced Test: Optimization');
  console.log('-'.repeat(50));
  
  const complexDescription = `
    Build a comprehensive SaaS platform with Next.js frontend, Node.js microservices backend, 
    PostgreSQL and MongoDB databases, Redis caching, GraphQL API, real-time features with WebSocket, 
    comprehensive testing including unit tests with Jest, integration tests, and e2e tests with Playwright. 
    Implement user authentication with OAuth, payment processing with Stripe, file uploads to S3, 
    email notifications, and monitoring with error tracking. Include Docker containerization, 
    CI/CD pipeline setup, and production deployment automation. Ensure security review and code quality checks.
  `;
  
  console.log('Planning complex SaaS platform...\n');
  const complexResult = await planner.planFlow(complexDescription);
  
  console.log('Original Flow Metrics:');
  console.log(`  • Nodes: ${complexResult.metrics.totalNodes}`);
  console.log(`  • Edges: ${complexResult.metrics.totalEdges}`);
  console.log(`  • Estimated Time: ${complexResult.metrics.estimatedTime} minutes`);
  
  console.log('\nOptimizing flow...');
  const optimizedFlow = planner.optimizeFlow(complexResult.flow);
  
  console.log('Optimized Flow:');
  console.log(`  • Edges after optimization: ${optimizedFlow.edges.length}`);
  
  writeFileSync(
    join(__dirname, 'output', 'flow-complex-saas.json'),
    JSON.stringify(complexResult.flow, null, 2)
  );
  
  console.log('\n✨ All tests completed!');
}

testPlanningService().catch(console.error);