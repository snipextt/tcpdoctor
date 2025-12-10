export namespace tcpmonitor {
	
	export class BasicStats {
	    DataBytesOut: number;
	    DataBytesIn: number;
	    DataSegsOut: number;
	    DataSegsIn: number;
	
	    static createFrom(source: any = {}) {
	        return new BasicStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.DataBytesOut = source["DataBytesOut"];
	        this.DataBytesIn = source["DataBytesIn"];
	        this.DataSegsOut = source["DataSegsOut"];
	        this.DataSegsIn = source["DataSegsIn"];
	    }
	}
	export class ExtendedStats {
	    TotalSegsOut: number;
	    TotalSegsIn: number;
	    ThruBytesAcked: number;
	    ThruBytesReceived: number;
	    SegsRetrans: number;
	    BytesRetrans: number;
	    FastRetrans: number;
	    TimeoutEpisodes: number;
	    SampleRTT: number;
	    SmoothedRTT: number;
	    RTTVariance: number;
	    MinRTT: number;
	    MaxRTT: number;
	    CurrentCwnd: number;
	    CurrentSsthresh: number;
	    SlowStartCount: number;
	    CongAvoidCount: number;
	    CurRetxQueue: number;
	    MaxRetxQueue: number;
	    CurAppWQueue: number;
	    MaxAppWQueue: number;
	    OutboundBandwidth: number;
	    InboundBandwidth: number;
	
	    static createFrom(source: any = {}) {
	        return new ExtendedStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.TotalSegsOut = source["TotalSegsOut"];
	        this.TotalSegsIn = source["TotalSegsIn"];
	        this.ThruBytesAcked = source["ThruBytesAcked"];
	        this.ThruBytesReceived = source["ThruBytesReceived"];
	        this.SegsRetrans = source["SegsRetrans"];
	        this.BytesRetrans = source["BytesRetrans"];
	        this.FastRetrans = source["FastRetrans"];
	        this.TimeoutEpisodes = source["TimeoutEpisodes"];
	        this.SampleRTT = source["SampleRTT"];
	        this.SmoothedRTT = source["SmoothedRTT"];
	        this.RTTVariance = source["RTTVariance"];
	        this.MinRTT = source["MinRTT"];
	        this.MaxRTT = source["MaxRTT"];
	        this.CurrentCwnd = source["CurrentCwnd"];
	        this.CurrentSsthresh = source["CurrentSsthresh"];
	        this.SlowStartCount = source["SlowStartCount"];
	        this.CongAvoidCount = source["CongAvoidCount"];
	        this.CurRetxQueue = source["CurRetxQueue"];
	        this.MaxRetxQueue = source["MaxRetxQueue"];
	        this.CurAppWQueue = source["CurAppWQueue"];
	        this.MaxAppWQueue = source["MaxAppWQueue"];
	        this.OutboundBandwidth = source["OutboundBandwidth"];
	        this.InboundBandwidth = source["InboundBandwidth"];
	    }
	}
	export class ConnectionInfo {
	    LocalAddr: string;
	    LocalPort: number;
	    RemoteAddr: string;
	    RemotePort: number;
	    State: number;
	    PID: number;
	    IsIPv6: boolean;
	    // Go type: time
	    LastSeen: any;
	    BasicStats?: BasicStats;
	    ExtendedStats?: ExtendedStats;
	    HighRetransmissionWarning: boolean;
	    HighRTTWarning: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.LocalAddr = source["LocalAddr"];
	        this.LocalPort = source["LocalPort"];
	        this.RemoteAddr = source["RemoteAddr"];
	        this.RemotePort = source["RemotePort"];
	        this.State = source["State"];
	        this.PID = source["PID"];
	        this.IsIPv6 = source["IsIPv6"];
	        this.LastSeen = this.convertValues(source["LastSeen"], null);
	        this.BasicStats = this.convertValues(source["BasicStats"], BasicStats);
	        this.ExtendedStats = this.convertValues(source["ExtendedStats"], ExtendedStats);
	        this.HighRetransmissionWarning = source["HighRetransmissionWarning"];
	        this.HighRTTWarning = source["HighRTTWarning"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class FilterOptions {
	    PID?: number;
	    Port?: number;
	    State?: number;
	    IPv4Only: boolean;
	    IPv6Only: boolean;
	    SearchText: string;
	
	    static createFrom(source: any = {}) {
	        return new FilterOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.PID = source["PID"];
	        this.Port = source["Port"];
	        this.State = source["State"];
	        this.IPv4Only = source["IPv4Only"];
	        this.IPv6Only = source["IPv6Only"];
	        this.SearchText = source["SearchText"];
	    }
	}
	export class HealthThresholds {
	    RetransmissionRatePercent: number;
	    HighRTTMilliseconds: number;
	
	    static createFrom(source: any = {}) {
	        return new HealthThresholds(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.RetransmissionRatePercent = source["RetransmissionRatePercent"];
	        this.HighRTTMilliseconds = source["HighRTTMilliseconds"];
	    }
	}

}

