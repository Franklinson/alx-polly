-- ALX Polly Database Setup Script
-- Run this script in your Supabase SQL editor to set up required tables and security

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create user_roles table for admin access control
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can grant roles" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Ensure polls table exists with proper structure
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL CHECK (length(question) <= 500),
    options JSONB NOT NULL CHECK (jsonb_array_length(options) >= 2 AND jsonb_array_length(options) <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on polls
CREATE INDEX IF NOT EXISTS idx_polls_user_id ON polls(user_id);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);

-- Enable RLS on polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- RLS policies for polls
CREATE POLICY "Users can view all polls" ON polls
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own polls" ON polls
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polls" ON polls
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polls OR admins can delete any poll" ON polls
    FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Ensure votes table exists with proper structure
CREATE TABLE IF NOT EXISTS votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    option_index INTEGER NOT NULL CHECK (option_index >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- Create indexes on votes
CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);

-- Unique constraint to prevent duplicate votes per user per poll
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_user_poll
    ON votes(poll_id, user_id) WHERE user_id IS NOT NULL;

-- Enable RLS on votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for votes
CREATE POLICY "Anyone can view vote counts" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON votes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to validate vote option_index against poll options
CREATE OR REPLACE FUNCTION validate_vote_option_index()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if option_index is within bounds of poll options
    IF NOT EXISTS (
        SELECT 1 FROM polls
        WHERE id = NEW.poll_id
        AND NEW.option_index < jsonb_array_length(options)
    ) THEN
        RAISE EXCEPTION 'Invalid option index for poll';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate vote option index
DROP TRIGGER IF EXISTS trigger_validate_vote_option_index ON votes;
CREATE TRIGGER trigger_validate_vote_option_index
    BEFORE INSERT ON votes
    FOR EACH ROW
    EXECUTE FUNCTION validate_vote_option_index();

-- Create audit log table for security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID DEFAULT NULL)
RETURNS VARCHAR(50) AS $$
DECLARE
    user_role VARCHAR(50) := 'user';
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND role = 'admin'
    LIMIT 1;

    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update functions to be accessible by authenticated users
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(VARCHAR(100), VARCHAR(50), UUID, JSONB) TO authenticated;

-- Insert default admin user (replace with your actual admin email)
-- Uncomment and modify the email below to create your first admin user
/*
INSERT INTO user_roles (user_id, role, granted_by, granted_at)
SELECT id, 'admin', id, NOW()
FROM auth.users
WHERE email = 'your-admin-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to polls
DROP TRIGGER IF EXISTS update_polls_updated_at ON polls;
CREATE TRIGGER update_polls_updated_at
    BEFORE UPDATE ON polls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Security: Revoke unnecessary permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Final security check: Ensure all tables have RLS enabled
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('polls', 'votes', 'user_roles', 'audit_logs')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END;
$$;

-- Success message
SELECT 'Database setup completed successfully!' as status;
