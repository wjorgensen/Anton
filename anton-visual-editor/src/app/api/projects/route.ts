import { NextRequest, NextResponse } from 'next/server';
import { clientProjectStorage } from '@/services/clientProjectStorage';

export async function GET() {
  try {
    const projects = await clientProjectStorage.listProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, prompt, circuitBoard } = await request.json();
    
    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      );
    }
    
    const project = await clientProjectStorage.createProject(name, prompt);
    
    // If circuit board was provided, update the project with it
    if (circuitBoard) {
      project.circuitBoard = circuitBoard;
      await clientProjectStorage.saveProject(project);
    }
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}