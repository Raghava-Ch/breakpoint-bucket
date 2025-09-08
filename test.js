// Test file for breakpoint groups extension
// Add some breakpoints to this file to test the extension

function authenticateUser(username, password) {
    // Add breakpoint here for authentication group
    console.log('Authenticating user:', username);
    
    if (!username || !password) {
        return false;
    }
    
    // Add breakpoint here for validation group
    const isValid = validateCredentials(username, password);
    
    if (isValid) {
        // Add breakpoint here for success group
        console.log('Authentication successful');
        return true;
    } else {
        // Add breakpoint here for error group
        console.log('Authentication failed');
        return false;
    }
}

function validateCredentials(username, password) {
    // Add breakpoint here for validation group
    console.log('Validating credentials');
    
    // Simulate validation logic
    return username.length > 3 && password.length > 6;
}

function fetchUserData(userId) {
    // Add breakpoint here for database group
    console.log('Fetching user data for:', userId);
    
    // Simulate database call
    return {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
    };
}

function processPayment(amount, cardNumber) {
    // Add breakpoint here for payment group
    console.log('Processing payment:', amount);
    
    if (!cardNumber) {
        // Add breakpoint here for error group
        throw new Error('Card number required');
    }
    
    // Simulate payment processing
    return {
        transactionId: 'txn_' + Date.now(),
        amount: amount,
        status: 'success'
    };
}

// Main execution
console.log('Starting application...');

const user = authenticateUser('john', 'password123');
if (user) {
    const userData = fetchUserData(1);
    console.log('User data:', userData);
    
    try {
        const payment = processPayment(100, '4111111111111111');
        console.log('Payment processed:', payment);
    } catch (error) {
        console.error('Payment failed:', error.message);
    }
}
