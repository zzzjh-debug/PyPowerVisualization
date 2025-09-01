function mpc = case9
% MATPOWER Case Format : Version 2
% System: IEEE 9-bus system
% Base MVA: 100

mpc.version = '2';
mpc.baseMVA = 100;

% Bus data
%	bus_i	type	Pd	Qd	Gs	Bs	area	Vm	Va	baseKV	zone	Vmax	Vmin
mpc.bus = [
	1	3	0	0	0	0	1	1.04	0	345	1	1.1	0.9;
	2	2	0	0	0	0	1	1.025	0	345	1	1.1	0.9;
	3	2	0	0	0	0	1	1.025	0	345	1	1.1	0.9;
	4	1	0	0	0	0	1	1.0	0	345	1	1.1	0.9;
	5	1	125	50	0	0	1	1.0	0	345	1	1.1	0.9;
	6	1	90	30	0	0	1	1.0	0	345	1	1.1	0.9;
	7	1	0	0	0	0	1	1.0	0	345	1	1.1	0.9;
	8	1	100	35	0	0	1	1.0	0	345	1	1.1	0.9;
	9	1	0	0	0	0	1	1.0	0	345	1	1.1	0.9;
];

% Generator data
%	bus	Pg	Qg	Qmax	Qmin	Vg	mBase	status	Pmax	Pmin
mpc.gen = [
	1	0	0	300	-300	1.04	100	1	250	10;
	2	163	0	300	-300	1.025	100	1	300	10;
	3	85	0	300	-300	1.025	100	1	300	10;
];

% Branch data
%	fbus	tbus	r	x	b	rateA	rateB	rateC	ratio	angle	status	angmin	angmax
mpc.branch = [
	1	4	0	0.0576	0	0	0	0	0	0	1	-360	360;
	4	5	0.01	0.085	0	0	0	0	0	0	1	-360	360;
	5	6	0.017	0.092	0	0	0	0	0	0	1	-360	360;
	3	6	0	0.0586	0	0	0	0	0	0	1	-360	360;
	6	9	0.039	0.17	0	0	0	0	0	0	1	-360	360;
	2	7	0	0.0625	0	0	0	0	0	0	1	-360	360;
	7	8	0.0085	0.072	0	0	0	0	0	0	1	-360	360;
	8	9	0.0119	0.1008	0	0	0	0	0	0	1	-360	360;
	4	7	0.032	0.161	0	0	0	0	0	0	1	-360	360;
];

% Generator cost data
%	1	startup	shutdown	n
cost_data = [
	2	0	0	3;
	0.11	5	100;
];

mpc.gencost = [
	cost_data;
	cost_data;
	cost_data;
];

% Bus coordinates for visualization (custom extension)
mpc.bus_coords = [
	1	100	150;
	2	200	100;
	3	200	200;
	4	300	50;
	5	300	150;
	6	300	250;
	7	400	100;
	8	400	200;
	9	500	150;
];

end