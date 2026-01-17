import React, { useEffect, useRef } from 'react';
import './AIChart.css';

interface DataPoint {
    label: string;
    value: number;
}

interface AIChartProps {
    type: string;
    title: string;
    dataPoints: DataPoint[];
    xLabel?: string;
    yLabel?: string;
}

const AIChart: React.FC<AIChartProps> = ({ type, title, dataPoints, xLabel, yLabel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !dataPoints || dataPoints.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (type === 'pie') {
            drawPieChart(ctx, dataPoints, rect.width, rect.height);
        } else if (type === 'bar') {
            drawBarChart(ctx, dataPoints, rect.width, rect.height, xLabel, yLabel);
        } else if (type === 'line') {
            drawLineChart(ctx, dataPoints, rect.width, rect.height, xLabel, yLabel);
        }
    }, [type, dataPoints, xLabel, yLabel]);

    const drawLineChart = (ctx: CanvasRenderingContext2D, data: DataPoint[], width: number, height: number, xLabel?: string, yLabel?: string) => {
        const padding = { top: 30, right: 30, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxValue = Math.max(...data.map(d => d.value)) * 1.1 || 1;
        const xStep = chartWidth / (data.length - 1 || 1);

        // Draw axes
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();

        // Draw grid lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        const steps = 5;
        ctx.textAlign = 'right';
        ctx.font = '11px Outfit, sans-serif';
        ctx.fillStyle = '#b0b0b0';

        for (let i = 0; i <= steps; i++) {
            const y = padding.top + chartHeight - (chartHeight / steps) * i;
            const val = (maxValue / steps) * i;

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();

            ctx.fillText(val.toFixed(val > 100 ? 0 : 1), padding.left - 10, y + 4);
        }

        // Draw line
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        data.forEach((point, idx) => {
            const x = padding.left + idx * xStep;
            const y = padding.top + chartHeight - (point.value / maxValue) * chartHeight;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw area under line
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
        gradient.addColorStop(1, 'rgba(33, 150, 243, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw points
        data.forEach((point, idx) => {
            const x = padding.left + idx * xStep;
            const y = padding.top + chartHeight - (point.value / maxValue) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2196F3';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // X-axis labels (sparse)
            if (data.length < 15 || idx % Math.ceil(data.length / 8) === 0) {
                ctx.save();
                ctx.fillStyle = '#b0b0b0';
                ctx.translate(x, padding.top + chartHeight + 15);
                ctx.rotate(-Math.PI / 6);
                ctx.textAlign = 'right';
                ctx.fillText(point.label, 0, 0);
                ctx.restore();
            }
        });

        // Axis labels
        if (yLabel) {
            ctx.save();
            ctx.fillStyle = '#e0e0e0';
            ctx.translate(15, padding.top + chartHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }
    };

    const drawPieChart = (ctx: CanvasRenderingContext2D, data: DataPoint[], width: number, height: number) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 60;

        const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FFC107', '#795548'];

        let startAngle = -Math.PI / 2;

        data.forEach((point, idx) => {
            const sliceAngle = (point.value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[idx % colors.length];
            ctx.fill();
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle = endAngle;
        });

        // Draw legend
        const legendX = 10;
        let legendY = 10;
        ctx.font = '500 11px Outfit, sans-serif';
        ctx.textAlign = 'left';

        data.forEach((point, idx) => {
            const percentage = ((point.value / total) * 100).toFixed(1);

            // Color box
            ctx.fillStyle = colors[idx % colors.length];
            ctx.fillRect(legendX, legendY, 12, 12);
            ctx.strokeStyle = '#1a1a1a';
            ctx.strokeRect(legendX, legendY, 12, 12);

            // Text
            ctx.fillStyle = '#e0e0e0';
            ctx.fillText(`${point.label} (${percentage}%)`, legendX + 18, legendY + 10);

            legendY += 18;
        });
    };

    const drawBarChart = (ctx: CanvasRenderingContext2D, data: DataPoint[], width: number, height: number, xLabel?: string, yLabel?: string) => {
        const padding = { top: 20, right: 20, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxValue = Math.max(...data.map(d => d.value));
        const barWidth = chartWidth / data.length * 0.8;
        const gap = chartWidth / data.length * 0.2;

        // Draw axes
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();

        // Draw bars
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, '#2196F3');
        gradient.addColorStop(1, '#1976D2');

        data.forEach((point, idx) => {
            const barHeight = (point.value / maxValue) * chartHeight;
            const x = padding.left + (idx * (barWidth + gap)) + gap / 2;
            const y = padding.top + chartHeight - barHeight;

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.strokeStyle = '#0D47A1';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, barWidth, barHeight);

            // Value label on top of bar
            ctx.fillStyle = '#fff';
            ctx.font = '600 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(point.value.toFixed(1), x + barWidth / 2, y - 5);

            // X-axis label
            ctx.fillStyle = '#b0b0b0';
            ctx.font = '11px Outfit, sans-serif';
            const truncatedLabel = point.label.length > 15 ? point.label.slice(0, 12) + '...' : point.label;
            ctx.save();
            ctx.translate(x + barWidth / 2, padding.top + chartHeight + 15);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(truncatedLabel, 0, 0);
            ctx.restore();
        });

        // Y-axis labels
        ctx.fillStyle = '#b0b0b0';
        ctx.font = '11px Outfit, sans-serif';
        ctx.textAlign = 'right';
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
            const value = (maxValue / steps) * i;
            const y = padding.top + chartHeight - (chartHeight / steps) * i;
            ctx.fillText(value.toFixed(0), padding.left - 10, y + 4);

            // Grid line
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }

        // Axis labels
        if (yLabel) {
            ctx.save();
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '600 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.translate(15, padding.top + chartHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }

        if (xLabel) {
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '600 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(xLabel, padding.left + chartWidth / 2, height - 5);
        }
    };

    return (
        <div className="ai-chart-container">
            <div className="chart-title">{title}</div>
            <canvas
                ref={canvasRef}
                className="ai-chart-canvas"
                style={{ width: '100%', height: type === 'pie' ? '280px' : '320px' }}
            />
        </div>
    );
};

export default AIChart;
