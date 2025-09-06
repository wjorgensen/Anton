-- CreateIndex
CREATE INDEX "executions_projectId_idx" ON "executions"("projectId");

-- CreateIndex
CREATE INDEX "executions_status_idx" ON "executions"("status");

-- CreateIndex
CREATE INDEX "executions_startedAt_idx" ON "executions"("startedAt");

-- CreateIndex
CREATE INDEX "executions_completedAt_idx" ON "executions"("completedAt");

-- CreateIndex
CREATE INDEX "node_executions_executionId_idx" ON "node_executions"("executionId");

-- CreateIndex
CREATE INDEX "node_executions_status_idx" ON "node_executions"("status");

-- CreateIndex
CREATE INDEX "node_executions_agentType_idx" ON "node_executions"("agentType");

-- CreateIndex
CREATE INDEX "node_executions_startedAt_idx" ON "node_executions"("startedAt");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE INDEX "projects_updatedAt_idx" ON "projects"("updatedAt");
