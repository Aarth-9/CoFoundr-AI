// mockData.js

// Generate realistic dummy data for 90 days
window.startupMockData = [];

function generateMockData() {
    let baseMRR = 12000;
    let baseUsers = 400;
    
    for (let i = 90; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Add random variance
        const dailyNewUsers = Math.floor(Math.random() * 15) + 2;
        const dailyChurn = Math.floor(Math.random() * 5);
        baseUsers += (dailyNewUsers - dailyChurn);
        
        // Revenue scales loosely with users, plus variance
        const dailyRevenue = (dailyNewUsers * 49) + Math.floor(Math.random() * 500);
        baseMRR += (dailyRevenue / 30); // simplistic MRR stretch

        window.startupMockData.push({
            date: date.toISOString().split('T')[0],
            timestamp: date.getTime(),
            dailyRevenue: dailyRevenue,
            mrr: Math.floor(baseMRR),
            activeUsers: baseUsers,
            newUsers: dailyNewUsers,
            churnedUsers: dailyChurn,
            txCount: Math.floor(Math.random() * 40) + 10,
            failedTx: Math.floor(Math.random() * 3)
        });
    }
}
generateMockData();

window.mockSubTiers = {
    free: 6200,
    pro: 840,
    enterprise: 45
};

window.mockAlerts = [
    { type: "success", text: "Revenue increased by 18% this week!" },
    { type: "warning", text: "Churn rate rising in last 3 days." },
    { type: "info", text: "Enterprise deal closed (Stripe: +$14k ARR)." },
    { type: "error", text: "API latency spike detected in US-East." }
];
