
const Model = {
    async getRates(currency, startDate, endDate) {
        const start = new Date(startDate + "T12:00:00");
        const end = new Date(endDate + "T12:00:00");

        const dates = [];

        for (
            let date = new Date(start);
            date <= end;
            date.setDate(date.getDate() + 1)
        ) {
            dates.push(new Date(date));
        }

        const results = [];
        const batchSize = 5;

        for (let i = 0; i < dates.length; i += batchSize) {
            const batch = dates.slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async date => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");

                    const formattedDate = `${year}${month}${day}`;

                    const url =
                        `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${encodeURIComponent(currency)}&date=${formattedDate}&json`;

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`NBU API error: ${response.status}`);
                    }

                    const data = await response.json();

                    if (!Array.isArray(data) || data.length === 0) {
                        return null;
                    }

                    return {
                        exchangedate: data[0].exchangedate,
                        rate: Number(data[0].rate)
                    };
                })
            );

            results.push(...batchResults.filter(item => item !== null));
        }

        return results.sort((a, b) => {
            const [dayA, monthA, yearA] = a.exchangedate.split(".");
            const [dayB, monthB, yearB] = b.exchangedate.split(".");

            return new Date(
                `${yearA}-${monthA}-${dayA}`
            ) - new Date(`${yearB}-${monthB}-${dayB}`);
        });
    }
};


const View = {
    chart: null,

    showMessage(message, type) {
        document.getElementById("message").innerHTML =
            `<div class="alert alert-${type}">${message}</div>`;
    },

    clearMessage() {
        document.getElementById("message").innerHTML = "";
    },

    showChart(data, currency) {
        const dates = data.map(item => item.exchangedate);
        const rates = data.map(item => item.rate);

        const context = document.getElementById("currencyChart");

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(context, {
            type: "line",

            data: {
                labels: dates,

                datasets: [{
                    label: `${currency} / UAH`,
                    data: rates,
                    borderColor: "#328653",
                    backgroundColor: "rgba(50, 134, 83, 0.12)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    borderWidth: 2
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: true,

                plugins: {
                    legend: {
                        display: true
                    },

                    tooltip: {
                        callbacks: {
                            label: context => {
                                return ` ${context.parsed.y.toFixed(4)} UAH`;
                            }
                        }
                    }
                },

                scales: {
                    y: {
                        beginAtZero: false,

                        title: {
                            display: true,
                            text: "Exchange rate (UAH)"
                        }
                    },

                    x: {
                        title: {
                            display: true,
                            text: "Date"
                        }
                    }
                }
            }
        });
    }
};


const Controller = {
    async analyze() {
        const currency = document.getElementById("currency").value;
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const button = document.getElementById("chartButton");

        if (!startDate || !endDate) {
            View.showMessage(
                "Please select both dates.",
                "warning"
            );
            return;
        }

        if (startDate > endDate) {
            View.showMessage(
                "Start date cannot be later than end date.",
                "warning"
            );
            return;
        }

        const days = (
            new Date(endDate + "T12:00:00") -
            new Date(startDate + "T12:00:00")
        ) / 86400000;

        if (days > 90) {
            View.showMessage(
                "Please select a period of 90 days or less.",
                "warning"
            );
            return;
        }

        button.disabled = true;
        button.textContent = "Loading...";

        View.clearMessage();

        try {
            const data = await Model.getRates(
                currency,
                startDate,
                endDate
            );

            if (data.length === 0) {
                View.showMessage(
                    "No exchange rate data found for this period.",
                    "warning"
                );
                return;
            }

            View.showChart(data, currency);

            View.showMessage(
                `Successfully loaded ${data.length} exchange rate records!`,
                "success"
            );

        } catch (error) {
            console.error("API Error:", error);

            View.showMessage(
                "Unable to load exchange rates. Please try again later.",
                "danger"
            );

        } finally {
            button.disabled = false;
            button.textContent = "Show Chart";
        }
    }
};


document.getElementById("chartButton").addEventListener("click", () => {
    Controller.analyze();
});


const today = new Date();

const previousMonth = new Date();
previousMonth.setDate(today.getDate() - 30);


const formatDate = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};


document.getElementById("startDate").value =
    formatDate(previousMonth);

document.getElementById("endDate").value =
    formatDate(today);

document.getElementById("startDate").max =
    formatDate(today);

document.getElementById("endDate").max =
    formatDate(today);
