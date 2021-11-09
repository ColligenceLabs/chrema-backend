const View = {
    allStatis:{
        dataYesterday : [],
        calculateGrowth(last_data, data){
            if (last_data == 0) return Math.round(data * 100) / 100 ;
            else return Math.round((Math.abs(data - last_data) / last_data * 100) * 100) / 100 ;
        },
        setRevenueGrowth(data){
            last_data   = data.data.find(element => element.name == 'last_revenue').total;
            last_data   = last_data == "None" ? 0 : last_data
            data        = data.data.find(element => element.name == 'revenue').total;
            data        = data == "None" ? 0 : data

            growth = data - last_data >= 0 ? true : false;
            if (growth) {
                $('.revenue-data').find('.per-color').removeClass('badge-red')
                $('.revenue-data').find('.per-icon').removeClass('anticon-arrow-down')
                $('.revenue-data').find('.per-color').addClass('badge-cyan')
                $('.revenue-data').find('.per-icon').addClass('anticon-arrow-up')
            }else{
                $('.revenue-data').find('.per-color').removeClass('badge-cyan')
                $('.revenue-data').find('.per-icon').removeClass('anticon-arrow-up')
                $('.revenue-data').find('.per-color').addClass('badge-red')
                $('.revenue-data').find('.per-icon').addClass('anticon-arrow-down')
            }
            $('.revenue-data').find('.per-value').html(this.calculateGrowth(last_data, data) + '%')
        },
        setOrderGrowth(data){
            last_data   = data.data.find(element => element.name == 'last_total_order').total;
            data        = data.data.find(element => element.name == 'total_order').total;
            growth = data - last_data >= 0 ? true : false;
            if (growth) {
                $('.order-data').find('.per-color').removeClass('badge-red')
                $('.order-data').find('.per-icon').removeClass('anticon-arrow-down')
                $('.order-data').find('.per-color').addClass('badge-cyan')
                $('.order-data').find('.per-icon').addClass('anticon-arrow-up')
            }else{
                $('.order-data').find('.per-color').removeClass('badge-cyan')
                $('.order-data').find('.per-icon').removeClass('anticon-arrow-up')
                $('.order-data').find('.per-color').addClass('badge-red')
                $('.order-data').find('.per-icon').addClass('anticon-arrow-down')
            }
            $('.order-data').find('.per-value').html(this.calculateGrowth(last_data, data) + '%')
        },
        setItemGrowth(data){
            last_data   = data.data.find(element => element.name == 'last_total_item').total;
            data        = data.data.find(element => element.name == 'total_item').total;
            growth = data - last_data >= 0 ? true : false;
            if (growth) {
                $('.item-data').find('.per-color').removeClass('badge-red')
                $('.item-data').find('.per-icon').removeClass('anticon-arrow-down')
                $('.item-data').find('.per-color').addClass('badge-cyan')
                $('.item-data').find('.per-icon').addClass('anticon-arrow-up')
            }else{
                $('.item-data').find('.per-color').removeClass('badge-cyan')
                $('.item-data').find('.per-icon').removeClass('anticon-arrow-up')
                $('.item-data').find('.per-color').addClass('badge-red')
                $('.item-data').find('.per-icon').addClass('anticon-arrow-down')
            }
            $('.item-data').find('.per-value').html(this.calculateGrowth(last_data, data) + '%')
        },
        render(data){
            $('.nft-data h2').text(data.nfts)
            $('.airdrops-data h2').text(data.airdrops)
            $('.companies-data h2').text(data.companies)
            $('.transactions-data h2').text(data.transactions)

        },
    },
    chartList:{
        header: [],
        dataNFTs: [],
        dataCollections: [],
        dataTotal: [],
        setData(data){
            console.log(data);
            data.map(v => {
                if (v.name == "total_revenue") this.dataTotal.push(v.value)
                else if (v.name == "nft_revenue") this.dataNFTs.push(v.value)
                else if (v.name == "collection_revenue") {
                    this.dataCollections.push(v.value)
                    this.header.push(moment(new Date(v.date)).local().format("DD/MM/YYYY"))
                }
            })

        },
        setHeader(data){

        },
        reset(){
            this.header = [];
            this.data = [];
            window.chart.destroy()
        },
        init(){
            const lineChart = document.getElementById("line-chart");
            const lineCtx = lineChart.getContext('2d');

            var gradient = lineCtx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, '#3f87f52b');   
            gradient.addColorStop(1, '#3f87f500');

            var config = {
                type: 'line',
                data: {
                    labels: this.header,
                    datasets: [{
                        label: 'NFTs Revenue',
                        // backgroundColor: "#eee",
                        // borderColor: "#ff5e00",
                        backgroundColor: "#3f87f5",
                        borderColor: "#3f87f5",
                        // borderWidth: 0,
                        data:  this.dataNFTs,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Collections Revenue',
                        // backgroundColor: "#eee",
                        // borderColor: "#55bad8",
                        backgroundColor: "#de4436",
                        borderColor: "#f77165",
                        // borderWidth: 0,
                        data:  this.dataCollections,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Total Revenue',
                        backgroundColor: "#6fc483",
                        borderColor: "#6fc483",
                        data:  this.dataTotal,
                        yAxisID: 'y1',
                    }]
                },
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    stacked: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Revenue In 30 Most Recent Days'
                        }
                    },
                    elements: {
                        line: {
                            tension: 0.4
                        }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            name: "revelue",
                            title: {
                                display: true,
                                text: 'Revenue'
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: {
                                drawOnChartArea: false, // only want the grid lines for one axis to show up
                            },
                            title: {
                                display: true,
                                text: 'Total'
                            }
                        },
                    },
                },
            }
            window.chart = new Chart(lineCtx, config);
        },
    },
    chartDonut:{
        header: [],
        data: [],
        setData(data){
            this.data = data.data;
        },
        setHeader(data){
            this.header = data.header;
            // for (var i = 1; i < 10; i++) {
            //     this.header.push(i)
            // }
        },
        reset(){
            this.header = [];
            this.data = [];
        },
        init(){
            const lineChart = document.getElementById("customers-chart");
            const lineCtx = lineChart.getContext('2d');

            const data = {
                labels: this.header,
                datasets: [
                    {
                        label: 'Dataset 1',
                        data: this.data,
                        backgroundColor: ['#ff0000', '#3cb371', '#ffd304', '#b4b4b4'],
                    }
                ]
            };
            var config = {
                type: 'doughnut',
                    data: data,
                    options: {
                        responsive: true,
                        cutoutPercentage: 60,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Pie Chart'
                            }
                        }
                    },
                }
            window.chart = new Chart(lineCtx, config);
        },
    },
    init() {

    }
};


(() => {
    
    View.init();

    Api.Statistics.GetLine()
        .done(res => {
            View.chartList.setData(res.data);
            View.chartList.setHeader(res.data);
            View.chartList.init();
        })

    Api.Statistics.GetSummaryPie()
        .done(res => {
            data = {
                'header' : res.data.pie_chart.header,
                'data' : res.data.pie_chart.data,
            };
            View.chartDonut.setData(data);
            View.chartDonut.setHeader(data);
            View.chartDonut.init();

            View.allStatis.render(res.data.summary)

        })
        
})();

