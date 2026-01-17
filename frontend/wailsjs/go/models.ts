export namespace llm {
	
	export class DiagnosticResult {
	    summary: string;
	    issues: string[];
	    possibleCauses: string[];
	    recommendations: string[];
	    severity: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summary = source["summary"];
	        this.issues = source["issues"];
	        this.possibleCauses = source["possibleCauses"];
	        this.recommendations = source["recommendations"];
	        this.severity = source["severity"];
	    }
	}
	export class HealthReport {
	    summary: string;
	    highlights: string[];
	    concerns: string[];
	    suggestions: string[];
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new HealthReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summary = source["summary"];
	        this.highlights = source["highlights"];
	        this.concerns = source["concerns"];
	        this.suggestions = source["suggestions"];
	        this.score = source["score"];
	    }
	}
	export class QueryResult {
	    answer: string;
	    success: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.answer = source["answer"];
	        this.success = source["success"];
	    }
	}

}

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
	export class CompactConnection {
	    localAddr: string;
	    localPort: number;
	    remoteAddr: string;
	    remotePort: number;
	    state: number;
	    pid: number;
	    bytesIn: number;
	    bytesOut: number;
	    segmentsIn: number;
	    segmentsOut: number;
	    rtt: number;
	    rttVariance: number;
	    minRtt: number;
	    maxRtt: number;
	    retrans: number;
	    segsRetrans: number;
	    congestionWin: number;
	    inBandwidth: number;
	    outBandwidth: number;
	
	    static createFrom(source: any = {}) {
	        return new CompactConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.localAddr = source["localAddr"];
	        this.localPort = source["localPort"];
	        this.remoteAddr = source["remoteAddr"];
	        this.remotePort = source["remotePort"];
	        this.state = source["state"];
	        this.pid = source["pid"];
	        this.bytesIn = source["bytesIn"];
	        this.bytesOut = source["bytesOut"];
	        this.segmentsIn = source["segmentsIn"];
	        this.segmentsOut = source["segmentsOut"];
	        this.rtt = source["rtt"];
	        this.rttVariance = source["rttVariance"];
	        this.minRtt = source["minRtt"];
	        this.maxRtt = source["maxRtt"];
	        this.retrans = source["retrans"];
	        this.segsRetrans = source["segsRetrans"];
	        this.congestionWin = source["congestionWin"];
	        this.inBandwidth = source["inBandwidth"];
	        this.outBandwidth = source["outBandwidth"];
	    }
	}
	export class ConnectionDiff {
	    connection: CompactConnection;
	    deltaIn: number;
	    deltaOut: number;
	    deltaRtt: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connection = this.convertValues(source["connection"], CompactConnection);
	        this.deltaIn = source["deltaIn"];
	        this.deltaOut = source["deltaOut"];
	        this.deltaRtt = source["deltaRtt"];
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
	export class ComparisonResult {
	    snapshot1: number;
	    snapshot2: number;
	    added: CompactConnection[];
	    removed: CompactConnection[];
	    changed: ConnectionDiff[];
	
	    static createFrom(source: any = {}) {
	        return new ComparisonResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.snapshot1 = source["snapshot1"];
	        this.snapshot2 = source["snapshot2"];
	        this.added = this.convertValues(source["added"], CompactConnection);
	        this.removed = this.convertValues(source["removed"], CompactConnection);
	        this.changed = this.convertValues(source["changed"], ConnectionDiff);
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
	
	export class ConnectionHistoryPoint {
	    // Go type: time
	    timestamp: any;
	    state: number;
	    bytesIn: number;
	    bytesOut: number;
	    segmentsIn: number;
	    segmentsOut: number;
	    rtt: number;
	    rttVariance: number;
	    minRtt: number;
	    maxRtt: number;
	    retrans: number;
	    segsRetrans: number;
	    congestionWin: number;
	    inBandwidth: number;
	    outBandwidth: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionHistoryPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.state = source["state"];
	        this.bytesIn = source["bytesIn"];
	        this.bytesOut = source["bytesOut"];
	        this.segmentsIn = source["segmentsIn"];
	        this.segmentsOut = source["segmentsOut"];
	        this.rtt = source["rtt"];
	        this.rttVariance = source["rttVariance"];
	        this.minRtt = source["minRtt"];
	        this.maxRtt = source["maxRtt"];
	        this.retrans = source["retrans"];
	        this.segsRetrans = source["segsRetrans"];
	        this.congestionWin = source["congestionWin"];
	        this.inBandwidth = source["inBandwidth"];
	        this.outBandwidth = source["outBandwidth"];
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
	    ExcludeInternal: boolean;
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
	        this.ExcludeInternal = source["ExcludeInternal"];
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
	export class RecordingSession {
	    id: number;
	    // Go type: time
	    startTime: any;
	    // Go type: time
	    endTime: any;
	    snapshotCount: number;
	
	    static createFrom(source: any = {}) {
	        return new RecordingSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.endTime = this.convertValues(source["endTime"], null);
	        this.snapshotCount = source["snapshotCount"];
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
	export class Snapshot {
	    id: number;
	    // Go type: time
	    timestamp: any;
	    connections: CompactConnection[];
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.connections = this.convertValues(source["connections"], CompactConnection);
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
	export class SnapshotMeta {
	    id: number;
	    // Go type: time
	    timestamp: any;
	    connectionCount: number;
	
	    static createFrom(source: any = {}) {
	        return new SnapshotMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.connectionCount = source["connectionCount"];
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
	export class TimelineConnection {
	    // Go type: time
	    timestamp: any;
	    connection: CompactConnection;
	
	    static createFrom(source: any = {}) {
	        return new TimelineConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.connection = this.convertValues(source["connection"], CompactConnection);
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

}

