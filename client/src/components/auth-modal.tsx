import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, MessageSquare, Loader2, AlertCircle, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { telegramManager } from '@/lib/telegram';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import type { TelegramSession } from '@shared/schema';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: TelegramSession) => void;
}

type AuthStep = 'login-options' | 'credentials' | 'phone' | 'code' | 'password' | 'custom-session';

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>('login-options');
  const [customSessionString, setCustomSessionString] = useState('');
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionCheckInterval, setSessionCheckInterval] = useState<NodeJS.Timeout | null>(null);
  // Hardcoded credentials for workspace replication - no environment dependency
  const [credentials, setCredentials] = useState({
    apiId: '28403662',
    apiHash: '079509d4ac7f209a1a58facd00d6ff5a',
    phoneNumber: '+917352013479',
    code: '',
    password: '',
  });

  const { toast } = useToast();

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [sessionCheckInterval]);

  useEffect(() => {
    // Listen for Telegram events
    const handleCodeRequired = () => {
      console.log('Code required event received');
      setStep('code');
      setLoading(false);
    };

    const handlePasswordRequired = () => {
      console.log('Password required event received');
      setStep('password');
      setLoading(false);
    };

    window.addEventListener('telegram:code-required', handleCodeRequired);
    window.addEventListener('telegram:password-required', handlePasswordRequired);

    return () => {
      window.removeEventListener('telegram:code-required', handleCodeRequired);
      window.removeEventListener('telegram:password-required', handlePasswordRequired);
    };
  }, []);

  const clearSessionCheck = () => {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      setSessionCheckInterval(null);
    }
  };

  const startSessionCheck = () => {
    clearSessionCheck();
    
    let checkCount = 0;
    const maxChecks = 50; // 25 seconds max
    
    const interval = setInterval(() => {
      checkCount++;
      console.log(`Checking for session... attempt ${checkCount}`);
      
      const session = telegramManager.getSession();
      if (session) {
        console.log('Session found!', session);
        clearInterval(interval);
        setSessionCheckInterval(null);
        handleSessionSuccess(session);
      } else if (checkCount >= maxChecks) {
        console.log('Session check timeout');
        clearInterval(interval);
        setSessionCheckInterval(null);
        setLoading(false);
        setError('Session creation timed out. Please try again.');
      }
    }, 500);
    
    setSessionCheckInterval(interval);
  };

  const handleSessionSuccess = async (session: TelegramSession) => {
    try {
      console.log('Processing successful session');
      setLoading(false);
      
      // Save session to storage
      await storage.saveSession(session);
      
      // Set localStorage flag
      localStorage.setItem('telegram_session', 'active');
      
      toast({
        title: 'Welcome!',
        description: `Successfully logged in as ${session.firstName || session.phoneNumber}`,
      });
      
      onSuccess(session);
    } catch (error) {
      console.error('Error handling session success:', error);
      setError('Failed to save session. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Handler for using default session string
  const handleUseDefaultSession = async () => {
    setLoading(true);
    setError('');
    clearSessionCheck();

    try {
      // Hardcoded default session string for workspace replication
      const predefinedSessionString = "1BQAWZmxvcmEud2ViLnRlbGVncmFtLm9yZwG7IS3tNY2BsIDLeDQnewXF0dZ7iEc231dYk/8TDX83hkgf7EwJ8HvdsqxWr/Dyb8oeEIe6+H9MAgI4yPaGs0IgIsdLQozbCnlNF7NDC+q5iC+JlpLbAF2PIiZ3nHvetmRyadZpTsVSLFgSG1BdvVUx2J65VHdkbJTk9V0hj2Wq3ucMrBNGJB6oCSrnSqWCD5mmtxKdFDV6p+6Fj1d0gbnmBOkhV0Ud+V6NRHDup/j6rREt/lJTO8gXowmd2dLt1piiQrmD3fU+zKEFf4Mv0GllJYYKY9aVxQjjhowXM8GdKnX0DLxOFVcqSk7sOkCn14ocdtYK4ffhRgJdgu241XriLA==";
      
      const sessionData: TelegramSession = {
        sessionString: predefinedSessionString,
        apiId: parseInt('28403662'),
        apiHash: '079509d4ac7f209a1a58facd00d6ff5a',
        phoneNumber: '+917352013479',
        userId: 'default-user',
        firstName: 'Default',
        lastName: 'User',
      };

      console.log('Loading default session...');
      await telegramManager.loadSession(sessionData);
      await handleSessionSuccess(sessionData);
    } catch (err) {
      console.error('Default session error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load default session');
    }
  };

  // Handler for using custom session string
  const handleSessionHistoryClick = () => {
    const password = prompt('Enter password for session history:');
    // Hardcoded session history password for workspace replication
    if (password === 'Sh@090609') {
      setShowSessionHistory(true);
    } else if (password !== null) {
      setError('Incorrect password');
    }
  };

  const handleSelectStoredSession = (sessionString: string) => {
    setCustomSessionString(sessionString);
    setShowSessionHistory(false);
  };

  const handleUseCustomSession = async () => {
    if (!customSessionString.trim()) {
      setError('Please enter a session string');
      return;
    }

    setLoading(true);
    setError('');
    clearSessionCheck();

    try {
      const sessionData: TelegramSession = {
        sessionString: customSessionString.trim(),
        apiId: parseInt('28403662'),
        apiHash: '079509d4ac7f209a1a58facd00d6ff5a',
        phoneNumber: "custom-session",
        userId: 'custom-user',
        firstName: 'Custom',
        lastName: 'User',
      };

      console.log('Loading custom session...');
      await telegramManager.loadSession(sessionData);
      
      // Save custom session for history
      const customSessions = JSON.parse(localStorage.getItem('custom_sessions') || '[]');
      if (!customSessions.includes(customSessionString.trim())) {
        customSessions.push(customSessionString.trim());
        localStorage.setItem('custom_sessions', JSON.stringify(customSessions));
      }

      await handleSessionSuccess(sessionData);
    } catch (err) {
      console.error('Custom session error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load custom session');
    }
  };

  const handleCredentialsSubmit = async () => {
    if (!credentials.apiId || !credentials.apiHash) {
      setError('Please provide both API ID and API Hash');
      return;
    }

    const apiId = parseInt(credentials.apiId);
    if (isNaN(apiId)) {
      setError('API ID must be a number');
      return;
    }

    setError('');
    setStep('phone');
  };

  const handlePhoneSubmit = async () => {
    if (!credentials.phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');
    clearSessionCheck();

    try {
      console.log('Starting phone authentication...');
      await telegramManager.authenticate(
        credentials.phoneNumber,
        parseInt(credentials.apiId),
        credentials.apiHash
      );
      // Authentication process will trigger code-required event
    } catch (err) {
      console.error('Phone authentication error:', err);
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      if (errorMessage.includes('PHONE_NUMBER_INVALID')) {
        setError('Invalid phone number format. Please include country code (e.g., +1234567890)');
      } else if (errorMessage.includes('FLOOD_WAIT')) {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleCodeSubmit = async () => {
    if (!credentials.code) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Sending verification code...');
      // Send the code response
      window.dispatchEvent(new CustomEvent('telegram:code-response', {
        detail: { code: credentials.code }
      }));

      // Start checking for session
      startSessionCheck();
    } catch (err) {
      console.error('Code submission error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Code verification failed');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!credentials.password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Sending 2FA password...');
      // Send the password response
      window.dispatchEvent(new CustomEvent('telegram:password-response', {
        detail: { password: credentials.password }
      }));

      // Start checking for session
      startSessionCheck();
    } catch (err) {
      console.error('Password submission error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Password verification failed');
    }
  };

  const handleClose = () => {
    if (!loading) {
      clearSessionCheck();
      setStep('login-options');
      // Reset to hardcoded credentials for workspace replication
      setCredentials({
        apiId: '28403662',
        apiHash: '079509d4ac7f209a1a58facd00d6ff5a',
        phoneNumber: '+917352013479',
        code: '',
        password: '',
      });
      setCustomSessionString('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {step === 'login-options' && <MessageSquare className="w-5 h-5" />}
            {step === 'credentials' && <Phone className="w-5 h-5" />}
            {step === 'phone' && <Phone className="w-5 h-5" />}
            {(step === 'code' || step === 'password') && <MessageSquare className="w-5 h-5" />}
            {step === 'custom-session' && <MessageSquare className="w-5 h-5" />}
            <span>
              {step === 'login-options' && 'Choose Login Method'}
              {step === 'credentials' && 'Telegram API Credentials'}
              {step === 'phone' && 'Enter Phone Number'}
              {step === 'code' && 'Verification Code'}
              {step === 'password' && 'Two-Factor Password'}
              {step === 'custom-session' && 'Enter Session String'}
            </span>
          </DialogTitle>
          {step === 'login-options' && (
            <DialogDescription>
              Choose how you want to login to Telegram Manager.
            </DialogDescription>
          )}
          {step === 'credentials' && (
            <DialogDescription>
              Enter your Telegram API credentials to authenticate with Telegram servers.
            </DialogDescription>
          )}
          {step === 'phone' && (
            <DialogDescription>
              Enter your phone number registered with Telegram to receive a verification code.
            </DialogDescription>
          )}
          {step === 'code' && (
            <DialogDescription>
              Enter the verification code sent to your phone number.
            </DialogDescription>
          )}
          {step === 'password' && (
            <DialogDescription>
              Enter your two-factor authentication password to complete login.
            </DialogDescription>
          )}
          {step === 'custom-session' && (
            <DialogDescription>
              Enter your Telegram session string to login instantly.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'login-options' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-6">
                  Choose your preferred login method
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleUseDefaultSession} 
                  className="w-full h-12 text-left justify-start"
                  variant="outline"
                  disabled={loading}
                  data-testid="button-default-session"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Use Default Session</div>
                      <div className="text-xs text-muted-foreground">Login instantly with saved session</div>
                    </div>
                  </div>
                </Button>

                <Button 
                  onClick={() => setStep('custom-session')} 
                  className="w-full h-12 text-left justify-start"
                  variant="outline"
                  data-testid="button-custom-session"
                >
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Enter Session String</div>
                      <div className="text-xs text-muted-foreground">Login with your own session string</div>
                    </div>
                  </div>
                </Button>

                <Button 
                  onClick={() => setStep('credentials')} 
                  className="w-full h-12 text-left justify-start"
                  variant="outline"
                  data-testid="button-full-auth"
                >
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Full Authentication</div>
                      <div className="text-xs text-muted-foreground">Login with API ID, Hash, and OTP</div>
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {step === 'custom-session' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Telegram session string to login instantly without OTP verification.
              </p>

              <div className="space-y-2">
                <Label htmlFor="session-string">Session String</Label>
                <div className="flex space-x-2">
                  <Input
                    id="session-string"
                    type="password"
                    placeholder="1BQAWZmxvcmE..."
                    value={customSessionString}
                    onChange={(e) => setCustomSessionString(e.target.value)}
                    data-testid="input-custom-session"
                    className="flex-1"
                  />
                  <Popover open={showSessionHistory} onOpenChange={setShowSessionHistory}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSessionHistoryClick}
                        data-testid="button-session-history"
                        title="View saved session history (password required)"
                        className="px-2"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Saved Sessions</h4>
                        {(() => {
                          const savedSessions = JSON.parse(localStorage.getItem('custom_sessions') || '[]');
                          if (savedSessions.length === 0) {
                            return <p className="text-sm text-muted-foreground">No saved sessions</p>;
                          }
                          return savedSessions.map((session: string, index: number) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectStoredSession(session)}
                                className="flex-1 text-left truncate"
                                data-testid={`button-saved-session-${index}`}
                              >
                                {session.substring(0, 20)}...
                              </Button>
                            </div>
                          ));
                        })()}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('login-options')} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-options"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleUseCustomSession} 
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-login-custom-session"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </div>
            </div>
          )}

          {step === 'credentials' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Telegram API credentials. You can get these from{' '}
                <a 
                  href="https://my.telegram.org/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  my.telegram.org/apps
                </a>
              </p>

              <div className="space-y-2">
                <Label htmlFor="api-id">API ID</Label>
                <Input
                  id="api-id"
                  type="number"
                  placeholder="123456789"
                  value={credentials.apiId}
                  onChange={(e) => handleInputChange('apiId', e.target.value)}
                  data-testid="input-api-id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-hash">API Hash</Label>
                <Input
                  id="api-hash"
                  type="password"
                  placeholder="abcdef123456789..."
                  value={credentials.apiHash}
                  onChange={(e) => handleInputChange('apiHash', e.target.value)}
                  data-testid="input-api-hash"
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('login-options')} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-options-from-credentials"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleCredentialsSubmit} 
                  className="flex-1"
                  data-testid="button-credentials-submit"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your phone number to receive a verification code
              </p>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={credentials.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  data-testid="input-phone"
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('credentials')} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-credentials"
                >
                  Back
                </Button>
                <Button 
                  onClick={handlePhoneSubmit} 
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-phone-submit"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Code
                </Button>
              </div>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the verification code sent to {credentials.phoneNumber}
              </p>

              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="12345"
                  value={credentials.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  data-testid="input-code"
                  autoFocus
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('phone')} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-phone"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleCodeSubmit} 
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-code-submit"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your two-factor authentication password
              </p>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  data-testid="input-password"
                  autoFocus
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('code')} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-code"
                >
                  Back
                </Button>
                <Button 
                  onClick={handlePasswordSubmit} 
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-password-submit"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}