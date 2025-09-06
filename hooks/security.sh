#!/bin/bash

# Anton v2 - Hook Security Module
# Implements security measures for safe hook execution
# Validates, sandboxes, and monitors hook scripts

set -euo pipefail

# Security configuration
ALLOWED_COMMANDS_FILE="${ALLOWED_COMMANDS_FILE:-/Users/wes/Programming/Anton/hooks/allowed-commands.txt}"
MAX_EXECUTION_TIME="${MAX_EXECUTION_TIME:-30}"
MAX_MEMORY_MB="${MAX_MEMORY_MB:-512}"
SANDBOX_DIR="${SANDBOX_DIR:-/tmp/anton-sandbox}"
LOG_FILE="${LOG_FILE:-/Users/wes/Programming/Anton/hooks/security.log}"

# Logging function
log_security() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SECURITY: $*" >> "$LOG_FILE"
}

# Function to validate hook command
validate_command() {
    local command="$1"
    local allowed_commands="${2:-$ALLOWED_COMMANDS_FILE}"
    
    # Extract the base command
    local base_command=$(echo "$command" | awk '{print $1}' | xargs basename)
    
    # Check if command is in allowed list
    if [[ -f "$allowed_commands" ]]; then
        if grep -qx "$base_command" "$allowed_commands"; then
            log_security "Command allowed: $base_command"
            return 0
        else
            log_security "Command blocked: $base_command"
            return 1
        fi
    else
        # If no allowed list, only allow specific safe commands
        case "$base_command" in
            echo|date|cat|grep|sed|awk|jq|curl|test|\[|\[\[)
                log_security "Built-in command allowed: $base_command"
                return 0
                ;;
            *.sh)
                # Check if it's one of our hooks
                if [[ "$command" =~ hooks/(stop|track-changes|subagent-complete|parse-test-results)\.sh ]]; then
                    log_security "Hook script allowed: $base_command"
                    return 0
                fi
                ;;
            *)
                log_security "Command not in safe list: $base_command"
                return 1
                ;;
        esac
    fi
    
    return 1
}

# Function to check for dangerous patterns
check_dangerous_patterns() {
    local command="$1"
    
    # List of dangerous patterns
    local dangerous_patterns=(
        "rm -rf /"
        "rm -rf /*"
        ":(){ :|:& };"  # Fork bomb
        "> /dev/sda"
        "dd if=/dev/zero"
        "mkfs."
        "chmod -R 777 /"
        "eval"
        "exec"
        "source /dev"
        "wget.*\|.*sh"
        "curl.*\|.*sh"
        "; rm "
        "&& rm "
        "| rm "
    )
    
    for pattern in "${dangerous_patterns[@]}"; do
        if [[ "$command" =~ $pattern ]]; then
            log_security "Dangerous pattern detected: $pattern"
            return 1
        fi
    done
    
    # Check for attempts to escape sandbox
    if [[ "$command" =~ \.\./\.\./\.\. ]] || [[ "$command" =~ /etc/passwd ]] || [[ "$command" =~ /etc/shadow ]]; then
        log_security "Potential sandbox escape attempt detected"
        return 1
    fi
    
    return 0
}

# Function to create sandboxed environment
create_sandbox() {
    local node_id="$1"
    local sandbox_path="${SANDBOX_DIR}/${node_id}"
    
    # Create sandbox directory
    mkdir -p "$sandbox_path"
    
    # Set restrictive permissions
    chmod 700 "$sandbox_path"
    
    # Create minimal environment
    mkdir -p "$sandbox_path"/{bin,tmp,hooks}
    
    # Copy only necessary binaries (if needed)
    # This would be more complex in production
    
    log_security "Sandbox created: $sandbox_path"
    echo "$sandbox_path"
}

# Function to execute hook with resource limits
execute_with_limits() {
    local command="$1"
    local timeout="${2:-$MAX_EXECUTION_TIME}"
    local memory_limit="${3:-$MAX_MEMORY_MB}"
    
    log_security "Executing with limits: timeout=${timeout}s, memory=${memory_limit}MB"
    
    # Use timeout command for time limit
    # Use ulimit for memory restrictions (if available)
    if command -v timeout &> /dev/null; then
        (
            # Set resource limits
            ulimit -v $((memory_limit * 1024)) 2>/dev/null || true  # Virtual memory limit
            ulimit -t "$timeout" 2>/dev/null || true                # CPU time limit
            
            # Execute command with timeout
            timeout --kill-after=5 "$timeout" bash -c "$command"
        )
    else
        # Fallback without timeout command
        bash -c "$command" &
        local pid=$!
        
        # Monitor execution time
        local count=0
        while kill -0 $pid 2>/dev/null && [[ $count -lt $timeout ]]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Kill if still running
        if kill -0 $pid 2>/dev/null; then
            log_security "Command exceeded timeout, terminating"
            kill -TERM $pid 2>/dev/null || true
            sleep 2
            kill -KILL $pid 2>/dev/null || true
        fi
        
        wait $pid
    fi
}

# Function to monitor hook execution
monitor_execution() {
    local node_id="$1"
    local command="$2"
    local start_time=$(date +%s)
    
    # Log execution start
    log_security "Starting execution for node $node_id: $command"
    
    # Monitor system resources during execution
    {
        while true; do
            if [[ -d "/proc/$$" ]]; then
                local mem_usage=$(ps -o rss= -p $$ 2>/dev/null || echo "0")
                local cpu_usage=$(ps -o %cpu= -p $$ 2>/dev/null || echo "0")
                
                if [[ ${mem_usage:-0} -gt $((MAX_MEMORY_MB * 1024)) ]]; then
                    log_security "WARNING: Memory limit exceeded for node $node_id"
                fi
                
                sleep 5
            else
                break
            fi
        done
    } &
    local monitor_pid=$!
    
    # Execute command
    local exit_code=0
    execute_with_limits "$command" || exit_code=$?
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    
    # Log execution end
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_security "Execution completed for node $node_id: duration=${duration}s, exit_code=$exit_code"
    
    return $exit_code
}

# Function to sanitize environment variables
sanitize_environment() {
    # Remove potentially dangerous environment variables
    unset LD_PRELOAD
    unset LD_LIBRARY_PATH
    unset DYLD_INSERT_LIBRARIES
    unset DYLD_LIBRARY_PATH
    
    # Set safe defaults
    export PATH="/usr/local/bin:/usr/bin:/bin"
    export SHELL="/bin/bash"
    export HOME="${SANDBOX_DIR:-/tmp}"
    
    log_security "Environment sanitized"
}

# Function to validate hook signature (optional)
validate_signature() {
    local hook_file="$1"
    local signature_file="${hook_file}.sig"
    
    if [[ -f "$signature_file" ]] && command -v openssl &> /dev/null; then
        # Verify signature using public key
        local public_key="${HOOK_PUBLIC_KEY:-/Users/wes/Programming/Anton/hooks/public.pem}"
        
        if [[ -f "$public_key" ]]; then
            if openssl dgst -sha256 -verify "$public_key" -signature "$signature_file" "$hook_file" &> /dev/null; then
                log_security "Signature valid for $hook_file"
                return 0
            else
                log_security "Invalid signature for $hook_file"
                return 1
            fi
        fi
    fi
    
    # No signature validation available
    return 0
}

# Main security check function
secure_hook_execution() {
    local node_id="$1"
    local hook_command="$2"
    local hook_type="${3:-unknown}"
    
    log_security "Security check initiated for node $node_id, hook type: $hook_type"
    
    # 1. Validate command
    if ! validate_command "$hook_command"; then
        log_security "ERROR: Command validation failed"
        return 1
    fi
    
    # 2. Check for dangerous patterns
    if ! check_dangerous_patterns "$hook_command"; then
        log_security "ERROR: Dangerous pattern detected"
        return 1
    fi
    
    # 3. Sanitize environment
    sanitize_environment
    
    # 4. Create sandbox (optional, depends on requirements)
    # local sandbox_path=$(create_sandbox "$node_id")
    
    # 5. Execute with monitoring and limits
    monitor_execution "$node_id" "$hook_command"
    local exit_code=$?
    
    log_security "Security check completed for node $node_id, exit code: $exit_code"
    return $exit_code
}

# Command-line interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        validate)
            validate_command "${2:-}"
            ;;
        check)
            check_dangerous_patterns "${2:-}"
            ;;
        execute)
            secure_hook_execution "${2:-node-1}" "${3:-echo test}" "${4:-test}"
            ;;
        *)
            echo "Usage: $0 {validate|check|execute} [arguments]"
            exit 1
            ;;
    esac
fi