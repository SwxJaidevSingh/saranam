import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Heart, Zap, AlertTriangle, Activity,
  X, Circle, Square, Diamond, Trash2,
  Download, Upload, RefreshCw, Layout, Eye, HelpCircle,
  Edit3, Check, Info, ZoomIn, ZoomOut, Link2, Camera
} from 'lucide-react';

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', shape: 'Square', icon: Square },
  { id: 'female', label: 'Female', shape: 'Circle', icon: Circle },
  { id: 'nonbinary', label: 'Non-Binary / Unknown', shape: 'Diamond', icon: Diamond },
  { id: 'miscarriage', label: 'Miscarriage / Abortion', shape: 'Triangle', icon: AlertTriangle },
  { id: 'pet', label: 'Pet / Animal', shape: 'Small Diamond', icon: Activity },
];

const CONDITION_COLORS = {
  heart: { label: 'Heart Disease', color: '#ef4444', icon: '❤️' },
  depression: { label: 'Mental Health / Depression', color: '#3b82f6', icon: '🧠' },
  substance: { label: 'Substance Abuse / Addiction', color: '#a855f7', icon: '🍷' },
  diabetes: { label: 'Diabetes / Metabolic', color: '#22c55e', icon: '🩺' },
  cancer: { label: 'Cancer / Critical Illness', color: '#f97316', icon: '🎗️' },
};

const RELATIONSHIP_TYPES = [
  { id: 'marriage', label: 'Marriage / Partnership', stroke: '#3b82f6', style: 'solid', icon: '💍' },
  { id: 'divorce', label: 'Divorced', stroke: '#ef4444', style: 'slashes', icon: '✂️' },
  { id: 'separation', label: 'Separated', stroke: '#f59e0b', style: 'slash', icon: '💔' },
  { id: 'parentChild', label: 'Parent - Child', stroke: '#64748b', style: 'solid', icon: '👨‍👧' },
  { id: 'adopted', label: 'Adopted Child', stroke: '#64748b', style: 'dashed', icon: '👶' },

  { id: 'conflictual', label: 'Conflictual / Hostile', stroke: '#dc2626', style: 'zigzag', icon: '⚡' },
  { id: 'close', label: 'Close Relationship', stroke: '#10b981', style: 'double', icon: '🟢' },
  { id: 'fused', label: 'Fused / Overinvolved', stroke: '#14b8a6', style: 'triple', icon: '🔗' },
  { id: 'distant', label: 'Distant / Estranged', stroke: '#94a3b8', style: 'dashed', icon: '░' },
  { id: 'cutoff', label: 'Cut-off / Broken', stroke: '#475569', style: 'cutoff', icon: '🛑' },
];

const DEFAULT_GENOGRAM = {
  nodes: [
    {
      id: 'n_proband',
      x: 300,
      y: 200,
      label: 'Index Patient',
      gender: 'male',
      age: '',
      birthYear: '',
      deathYear: '',
      isDeceased: false,
      isProband: true,
      conditions: [],
      color: '#ffffff',
      notes: '',
      isBeneficiary: false,
      isPrimaryCaregiver: false,
      isDecisionMaker: false,
      relationshipToPatient: ''
    }
  ],
  edges: []
};

/* Dynamic Sector/Segment Renderer supporting any number of active conditions (1 to 5+) */
const ConditionSegments = ({ conditions, size = 60 }) => {
  if (!conditions || conditions.length === 0) return null;

  const half = size / 2;
  const radius = half * 1.5; // Radiate out beyond bounds so SVG clipPath crops cleanly
  const total = conditions.length;

  // Single condition fills whole symbol area
  if (total === 1) {
    const color = CONDITION_COLORS[conditions[0]]?.color || '#3b82f6';
    return <rect x="0" y="0" width={size} height={size} fill={color} opacity={0.8} />;
  }

  // Generate dynamic N-sector pie slices for 2, 3, 4, 5+ conditions
  const slices = conditions.map((condKey, i) => {
    const meta = CONDITION_COLORS[condKey];
    if (!meta) return null;

    const startAngle = (i * 2 * Math.PI) / total - Math.PI / 2;
    const endAngle = ((i + 1) * 2 * Math.PI) / total - Math.PI / 2;

    const x1 = half + radius * Math.cos(startAngle);
    const y1 = half + radius * Math.sin(startAngle);
    const x2 = half + radius * Math.cos(endAngle);
    const y2 = half + radius * Math.sin(endAngle);

    const largeArcFlag = total <= 2 ? 0 : (endAngle - startAngle > Math.PI ? 1 : 0);

    const pathData = [
      `M ${half} ${half}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return (
      <path
        key={`${condKey}-${i}`}
        d={pathData}
        fill={meta.color}
        opacity={0.85}
        stroke="hsl(var(--card))"
        strokeWidth="1"
      />
    );
  });

  return <g className="pointer-events-none">{slices}</g>;
};

// Helper to check if a coordinate point is inside a polygon (ray-casting algorithm)
const isPointInPolygon = (point, polygon) => {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export default function GenogramBuilder({ value, onChange }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedLoopIdx, setSelectedLoopIdx] = useState(null);

  const [activeEdgeType, setActiveEdgeType] = useState('marriage');
  const [connectingSourceId, setConnectingSourceId] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 30, y: 30 });
  const [zoom, setZoom] = useState(0.9);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Node Drag state
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [nodeOffset, setNodeOffset] = useState({ x: 0, y: 0 });

  // Drawing state for freehand household loop
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [householdPaths, setHouseholdPaths] = useState([]);

  // Freehand loop editing state (scaling/moving)
  const [activeLoopAction, setActiveLoopAction] = useState(null);
  const [loopDragStart, setLoopDragStart] = useState(null);

  // Custom overridden beneficiary count state
  const [customBeneficiaryCount, setCustomBeneficiaryCount] = useState(null);

  const canvasRef = useRef(null);

  // Sync state from value prop on load
  useEffect(() => {
    if (value && value.nodes) {
      setNodes(value.nodes || []);
      setEdges(value.edges || []);
      // Backwards compatibility: load householdPaths, fallback to array containing old householdPath
      const loadedPaths = value.householdPaths || (value.householdPath ? [value.householdPath] : []);
      setHouseholdPaths(loadedPaths);
      setCustomBeneficiaryCount(value.customBeneficiaryCount !== undefined && value.customBeneficiaryCount !== null ? value.customBeneficiaryCount : null);
    } else {
      setNodes(DEFAULT_GENOGRAM.nodes);
      setEdges(DEFAULT_GENOGRAM.edges);
      setHouseholdPaths([]);
      setCustomBeneficiaryCount(null);
    }
  }, [value]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  const triggerChange = (newNodes, newEdges, newPaths = householdPaths, newCustomCount = customBeneficiaryCount) => {
    onChange({ nodes: newNodes, edges: newEdges, householdPaths: newPaths, customBeneficiaryCount: newCustomCount });
  };

  const perpendicularDistance = (p, p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(p.x - p1.x, p.y - p1.y);
    }
    const num = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
    const den = Math.hypot(dx, dy);
    return num / den;
  };

  const simplifyPath = (points, epsilon) => {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let index = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], points[0], points[end]);
      if (dist > maxDist) {
        index = i;
        maxDist = dist;
      }
    }
    if (maxDist > epsilon) {
      const results1 = simplifyPath(points.slice(0, index + 1), epsilon);
      const results2 = simplifyPath(points.slice(index), epsilon);
      return results1.slice(0, results1.length - 1).concat(results2);
    } else {
      return [points[0], points[end]];
    }
  };

  const simplifyPolygon = (points, epsilon = 25) => {
    if (points.length <= 3) return points;
    
    // 1. Pre-filter coordinates that are too close together to guarantee clean handle spacing
    const minSpacing = 40; // Spacing of at least 40px
    const filteredPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const last = filteredPoints[filteredPoints.length - 1];
      const dist = Math.hypot(points[i].x - last.x, points[i].y - last.y);
      if (dist >= minSpacing) {
        filteredPoints.push(points[i]);
      }
    }
    
    // Ensure loop closes cleanly at the end
    const lastOrig = points[points.length - 1];
    const lastFiltered = filteredPoints[filteredPoints.length - 1];
    if (lastFiltered.x !== lastOrig.x || lastFiltered.y !== lastOrig.y) {
      filteredPoints.push(lastOrig);
    }

    // 2. Apply Ramer-Douglas-Peucker simplification
    const isOpen = filteredPoints[0].x !== filteredPoints[filteredPoints.length - 1].x || filteredPoints[0].y !== filteredPoints[filteredPoints.length - 1].y;
    const openPoints = isOpen ? filteredPoints : filteredPoints.slice(0, filteredPoints.length - 1);
    const simplified = simplifyPath(openPoints, epsilon);
    return [...simplified, simplified[0]];
  };

  const getCentroid = (path) => {
    if (!path || path.length === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0;
    path.forEach(p => {
      sumX += p.x;
      sumY += p.y;
    });
    return { x: sumX / path.length, y: sumY / path.length };
  };

  const handleBoundaryPathMouseDown = (e, pathIdx) => {
    e.stopPropagation();
    setActiveLoopAction('resize');
    setSelectedLoopIdx(pathIdx);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveTab('inspector');
    
    const path = householdPaths[pathIdx];
    const centroid = getCentroid(path);
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    const initialDist = Math.hypot(mx - centroid.x, my - centroid.y);
    setLoopDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialPath: [...path],
      centroid,
      initialDist: initialDist > 5 ? initialDist : 5,
      pathIdx
    });
  };

  const handleBoundaryFillMouseDown = (e, pathIdx) => {
    e.stopPropagation();
    setActiveLoopAction('move');
    setSelectedLoopIdx(pathIdx);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveTab('inspector');

    const path = householdPaths[pathIdx];
    setLoopDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialPath: [...path],
      pathIdx
    });
  };

  const handleVertexMouseDown = (e, pathIdx, vertexIdx) => {
    e.stopPropagation();
    setActiveLoopAction('vertex-drag');
    setSelectedLoopIdx(pathIdx);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveTab('inspector');

    const path = householdPaths[pathIdx];
    setLoopDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialPath: [...path],
      pathIdx,
      vertexIdx
    });
  };

  const handleCanvasMouseDown = (e) => {
    if (isDrawingMode) {
      setIsDrawing(true);
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setCurrentPath([{ x: canvasX, y: canvasY }]);
      return;
    }

    // Only pan if clicking direct SVG background
    if (e.target.tagName === 'svg' || e.target.id === 'canvas-bg') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedLoopIdx(null);
      setConnectingSourceId(null);
    }
  };

  const handleMouseMove = (e) => {
    if (activeLoopAction === 'resize' && loopDragStart) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      const centroid = loopDragStart.centroid;
      const currentDist = Math.hypot(mx - centroid.x, my - centroid.y);
      const scale = currentDist / loopDragStart.initialDist;
      
      const scaledPath = loopDragStart.initialPath.map(p => ({
        x: centroid.x + (p.x - centroid.x) * scale,
        y: centroid.y + (p.y - centroid.y) * scale
      }));
      
      const updatedPaths = householdPaths.map((path, idx) => 
        idx === loopDragStart.pathIdx ? scaledPath : path
      );
      setHouseholdPaths(updatedPaths);

      const updatedNodes = nodes.map(node => {
        if (node.isProband) return node;
        const center = { x: node.x + 30, y: node.y + 30 };
        const isEnclosed = updatedPaths.some(path => isPointInPolygon(center, path));
        return { ...node, isBeneficiary: isEnclosed };
      });
      setNodes(updatedNodes);
      return;
    }

    if (activeLoopAction === 'move' && loopDragStart) {
      const dx = (e.clientX - loopDragStart.clientX) / zoom;
      const dy = (e.clientY - loopDragStart.clientY) / zoom;
      
      const translatedPath = loopDragStart.initialPath.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));
      
      const updatedPaths = householdPaths.map((path, idx) => 
        idx === loopDragStart.pathIdx ? translatedPath : path
      );
      setHouseholdPaths(updatedPaths);

      const updatedNodes = nodes.map(node => {
        if (node.isProband) return node;
        const center = { x: node.x + 30, y: node.y + 30 };
        const isEnclosed = updatedPaths.some(path => isPointInPolygon(center, path));
        return { ...node, isBeneficiary: isEnclosed };
      });
      setNodes(updatedNodes);
      return;
    }

    if (activeLoopAction === 'vertex-drag' && loopDragStart) {
      const dx = (e.clientX - loopDragStart.clientX) / zoom;
      const dy = (e.clientY - loopDragStart.clientY) / zoom;
      const vertexIdx = loopDragStart.vertexIdx;
      
      const updatedPath = loopDragStart.initialPath.map((p, idx) => {
        if (idx === vertexIdx) {
          return { x: p.x + dx, y: p.y + dy };
        }
        return p;
      });

      // Maintain loop closure
      const lastIdx = updatedPath.length - 1;
      if (vertexIdx === 0) {
        updatedPath[lastIdx] = updatedPath[0];
      } else if (vertexIdx === lastIdx) {
        updatedPath[0] = updatedPath[lastIdx];
      }

      const updatedPaths = householdPaths.map((path, idx) => 
        idx === loopDragStart.pathIdx ? updatedPath : path
      );
      setHouseholdPaths(updatedPaths);

      const updatedNodes = nodes.map(node => {
        if (node.isProband) return node;
        const center = { x: node.x + 30, y: node.y + 30 };
        const isEnclosed = updatedPaths.some(path => isPointInPolygon(center, path));
        return { ...node, isBeneficiary: isEnclosed };
      });
      setNodes(updatedNodes);
      return;
    }

    if (isDrawingMode && isDrawing) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setCurrentPath(prev => [...prev, { x: canvasX, y: canvasY }]);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingNodeId) {
      const newX = (e.clientX - pan.x) / zoom - nodeOffset.x;
      const newY = (e.clientY - pan.y) / zoom - nodeOffset.y;

      const updated = nodes.map(node =>
        node.id === draggingNodeId ? { ...node, x: Math.round(newX / 10) * 10, y: Math.round(newY / 10) * 10 } : node
      );
      setNodes(updated);
      triggerChange(updated, edges);
    }
  };

  const handleMouseUp = () => {
    if (activeLoopAction) {
      setActiveLoopAction(null);
      setLoopDragStart(null);
      triggerChange(nodes, edges, householdPaths);
      return;
    }

    if (isDrawingMode && isDrawing) {
      setIsDrawing(false);
      if (currentPath.length > 2) {
        const closedPath = simplifyPolygon([...currentPath, currentPath[0]], 25);
        const updatedPaths = [...householdPaths, closedPath];
        setHouseholdPaths(updatedPaths);

        const updatedNodes = nodes.map(node => {
          if (node.isProband) return node;
          const center = { x: node.x + 30, y: node.y + 30 };
          const isEnclosed = updatedPaths.some(path => isPointInPolygon(center, path));
          return { ...node, isBeneficiary: isEnclosed };
        });

        setNodes(updatedNodes);
        triggerChange(updatedNodes, edges, updatedPaths);
      }
      setCurrentPath([]);
      setIsDrawingMode(false);
      return;
    }

    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    if (connectingSourceId) {
      if (connectingSourceId !== nodeId) {
        // Create edge
        const newEdge = {
          id: `e_${Date.now()}`,
          source: connectingSourceId,
          target: nodeId,
          type: activeEdgeType,
          label: RELATIONSHIP_TYPES.find(r => r.id === activeEdgeType)?.label || ''
        };
        const updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
        triggerChange(nodes, updatedEdges);
      }
      setConnectingSourceId(null);
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedLoopIdx(null);
    setActiveTab('inspector');

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDraggingNodeId(nodeId);
      setNodeOffset({
        x: (e.clientX - pan.x) / zoom - node.x,
        y: (e.clientY - pan.y) / zoom - node.y
      });
    }
  };

  const addPersonNode = (genderType) => {
    const id = `node_${Date.now()}`;
    const newNode = {
      id,
      x: 180 + (Math.random() * 80 - 40),
      y: 150 + (Math.random() * 80 - 40),
      label: genderType === 'pet' ? 'Pet Name' : `Person ${nodes.length + 1}`,
      gender: genderType,
      age: '30',
      birthYear: String(new Date().getFullYear() - 30),
      deathYear: '',
      isDeceased: false,
      isProband: false,
      conditions: [],
      color: '#ffffff',
      notes: '',
      isBeneficiary: false,
      isPrimaryCaregiver: false,
      isDecisionMaker: false,
      relationshipToPatient: ''
    };
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    triggerChange(updatedNodes, edges);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setActiveTab('inspector');
  };

  const updateSelectedNode = (key, value) => {
    if (!selectedNodeId) return;
    const updated = nodes.map(n => {
      if (n.id === selectedNodeId) {
        return { ...n, [key]: value };
      } else {
        // Enforce mutual exclusivity for caregiver and decision maker roles
        if (key === 'isPrimaryCaregiver' && value === true) {
          return { ...n, isPrimaryCaregiver: false };
        }
        if (key === 'isDecisionMaker' && value === true) {
          return { ...n, isDecisionMaker: false };
        }
        return n;
      }
    });
    setNodes(updated);
    triggerChange(updated, edges);
  };

  const toggleCondition = (condKey) => {
    if (!selectedNode) return;
    const current = selectedNode.conditions || [];
    const updated = current.includes(condKey)
      ? current.filter(c => c !== condKey)
      : [...current, condKey];
    updateSelectedNode('conditions', updated);
  };

  const updateSelectedEdge = (key, value) => {
    if (!selectedEdgeId) return;
    const updated = edges.map(e => e.id === selectedEdgeId ? { ...e, [key]: value } : e);
    setEdges(updated);
    triggerChange(nodes, updated);
  };

  const deleteSelected = () => {
    if (selectedNodeId) {
      const updatedNodes = nodes.filter(n => n.id !== selectedNodeId);
      const updatedEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      triggerChange(updatedNodes, updatedEdges);
      setSelectedNodeId(null);
    }
    if (selectedEdgeId) {
      const updatedEdges = edges.filter(e => e.id !== selectedEdgeId);
      setEdges(updatedEdges);
      triggerChange(nodes, updatedEdges);
      setSelectedEdgeId(null);
    }
  };

  const autoLayout = () => {
    const sorted = [...nodes].sort((a, b) => (parseInt(b.birthYear) || 0) - (parseInt(a.birthYear) || 0));
    const tiers = { 0: [], 1: [], 2: [] };

    sorted.forEach(node => {
      const year = parseInt(node.birthYear) || 1990;
      if (year < 1960) tiers[0].push(node);
      else if (year < 1985) tiers[1].push(node);
      else tiers[2].push(node);
    });

    const updated = nodes.map(node => {
      let tierIdx = 2;
      let posIdx = 0;
      Object.keys(tiers).forEach(t => {
        const idx = tiers[t].findIndex(n => n.id === node.id);
        if (idx !== -1) {
          tierIdx = parseInt(t);
          posIdx = idx;
        }
      });
      return {
        ...node,
        x: 100 + posIdx * 180,
        y: 80 + tierIdx * 160
      };
    });
    setNodes(updated);
    triggerChange(updated, edges);
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `genogram_${Date.now()}.json`);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const importJSON = (e) => {
    const reader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      reader.readAsText(e.target.files[0], "UTF-8");
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.nodes && parsed.edges) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
            triggerChange(parsed.nodes, parsed.edges);
          }
        } catch (err) {
          alert("Invalid Genogram file format.");
        }
      };
    }
  };

  const renderEdge = (edge) => {
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return null;

    const size = 60;
    const x1 = srcNode.x + size / 2;
    const y1 = srcNode.y + size / 2;
    const x2 = tgtNode.x + size / 2;
    const y2 = tgtNode.y + size / 2;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const isSelected = selectedEdgeId === edge.id;
    const relMeta = RELATIONSHIP_TYPES.find(r => r.id === edge.type) || RELATIONSHIP_TYPES[0];
    const stroke = relMeta.stroke;

    let pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    if (edge.type === 'parentChild' || edge.type === 'adopted') {
      let startX = x1;
      let startY = y1;

      if (edge.connectToMidpoint !== false) {
        // Find if this parent node (srcNode) is connected to a spouse via a marriage line
        const marriageEdge = edges.find(e =>
          (e.source === edge.source || e.target === edge.source) &&
          ['marriage', 'divorce', 'separation'].includes(e.type)
        );

        if (marriageEdge) {
          const spouseId = marriageEdge.source === edge.source ? marriageEdge.target : marriageEdge.source;
          const spouseNode = nodes.find(n => n.id === spouseId);
          if (spouseNode) {
            const spouseX = spouseNode.x + size / 2;
            const spouseY = spouseNode.y + size / 2;
            startX = (x1 + spouseX) / 2;
            startY = (y1 + spouseY) / 2;
          }
        }
      }

      const breakY = (startY + y2) / 2;
      pathD = `M ${startX} ${startY} L ${startX} ${breakY} L ${x2} ${breakY} L ${x2} ${y2}`;
    }




    return (
      <g key={edge.id} className="cursor-pointer group" onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); setSelectedLoopIdx(null); setActiveTab('inspector'); }}>
        {/* Transparent hit target */}
        <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} />

        {/* Main Edge Line */}
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth={isSelected ? 4 : 2.5}
          strokeDasharray={edge.type === 'distant' ? '6,6' : edge.type === 'cutoff' ? '4,4' : edge.type === 'adopted' ? '5,5' : undefined}
          className="transition-all duration-150"
        />


        {/* Multi-line decorations */}
        {edge.type === 'close' && (
          <path d={pathD} fill="none" stroke={stroke} strokeWidth={1.5} transform="translate(0, 3)" />
        )}
        {edge.type === 'fused' && (
          <>
            <path d={pathD} fill="none" stroke={stroke} strokeWidth={1.5} transform="translate(0, -3)" />
            <path d={pathD} fill="none" stroke={stroke} strokeWidth={1.5} transform="translate(0, 3)" />
          </>
        )}

        {/* Cut / Divorce / Separation symbols at midpoint */}
        {edge.type === 'divorce' && (
          <g transform={`translate(${midX}, ${midY})`}>
            <line x1="-8" y1="-8" x2="2" y2="8" stroke="#ef4444" strokeWidth="3" />
            <line x1="-2" y1="-8" x2="8" y2="8" stroke="#ef4444" strokeWidth="3" />
          </g>
        )}
        {edge.type === 'separation' && (
          <g transform={`translate(${midX}, ${midY})`}>
            <line x1="-4" y1="-8" x2="4" y2="8" stroke="#f59e0b" strokeWidth="3" />
          </g>
        )}
        {edge.type === 'conflictual' && (
          <g transform={`translate(${midX - 15}, ${midY - 5})`}>
            <path d="M 0 5 Q 5 0 10 5 T 20 5 T 30 5" fill="none" stroke="#dc2626" strokeWidth="3" />
          </g>
        )}
        {edge.type === 'cutoff' && (
          <g transform={`translate(${midX}, ${midY})`}>
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#475569" strokeWidth="3" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#dc2626" strokeWidth="3" />
          </g>
        )}

        {/* Edge Label Badge */}
        {edge.label && (
          <g transform={`translate(${midX}, ${midY + 16})`}>
            <rect x="-35" y="-10" width="70" height="20" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
            <text x="0" y="3" textAnchor="middle" fill="currentColor" className="text-foreground" fontSize="10" fontWeight="600">
              {edge.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  const renderNode = (node) => {
    const size = 60;
    const half = size / 2;
    const isSelected = selectedNodeId === node.id;
    const isConnecting = connectingSourceId === node.id;
    const isAdopted = edges.some(e => e.target === node.id && e.type === 'adopted');

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        className="cursor-pointer select-none group"
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
      >

        {/* Active Selection / Connecting Ring */}
        {(isSelected || isConnecting) && (
          <rect
            x="-8"
            y="-8"
            width={size + 16}
            height={size + 16}
            rx="12"
            fill="none"
            stroke={isConnecting ? '#f59e0b' : 'hsl(var(--primary))'}
            strokeWidth="2.5"
            strokeDasharray={isConnecting ? '4,4' : 'none'}
            className="animate-pulse"
          />
        )}

        {/* Main Base Symbol */}
        <g>
          {isAdopted && (
            <g stroke="currentColor" className="text-foreground" strokeWidth="2.5" fill="none">
              <path d={`M -6 -6 L -12 -6 L -12 ${size + 6} L -6 ${size + 6}`} />
              <path d={`M ${size + 6} -6 L ${size + 12} -6 L ${size + 12} ${size + 6} L ${size + 6} ${size + 6}`} />
            </g>
          )}
          {node.gender === 'male' && (

            <>
              {node.isProband && (
                <rect x="-5" y="-5" width={size + 10} height={size + 10} rx="4" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
              )}
              <rect x="0" y="0" width={size} height={size} rx="3" fill={node.color || 'hsl(var(--card))'} stroke="currentColor" className="text-foreground" strokeWidth="2.5" />
              <g clipPath={`url(#square-clip-${node.id})`}>
                <clipPath id={`square-clip-${node.id}`}>
                  <rect x="0" y="0" width={size} height={size} rx="3" />
                </clipPath>
                <ConditionSegments conditions={node.conditions} size={size} />
              </g>
            </>
          )}

          {node.gender === 'female' && (
            <>
              {node.isProband && (
                <circle cx={half} cy={half} r={half + 5} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
              )}
              <circle cx={half} cy={half} r={half} fill={node.color || 'hsl(var(--card))'} stroke="currentColor" className="text-foreground" strokeWidth="2.5" />
              <g clipPath={`url(#circle-clip-${node.id})`}>
                <clipPath id={`circle-clip-${node.id}`}>
                  <circle cx={half} cy={half} r={half - 1} />
                </clipPath>
                <ConditionSegments conditions={node.conditions} size={size} />
              </g>
            </>
          )}

          {node.gender === 'nonbinary' && (
            <>
              {node.isProband && (
                <polygon points={`${half},-6 ${size + 6},${half} ${half},${size + 6} -6,${half}`} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
              )}
              <polygon points={`${half},0 ${size},${half} ${half},${size} 0,${half}`} fill={node.color || 'hsl(var(--card))'} stroke="currentColor" className="text-foreground" strokeWidth="2.5" />
              <g clipPath={`url(#diamond-clip-${node.id})`}>
                <clipPath id={`diamond-clip-${node.id}`}>
                  <polygon points={`${half},0 ${size},${half} ${half},${size} 0,${half}`} />
                </clipPath>
                <ConditionSegments conditions={node.conditions} size={size} />
              </g>
            </>
          )}

          {node.gender === 'miscarriage' && (
            <polygon points={`${half},4 ${size - 4},${size - 4} 4,${size - 4}`} fill={node.isDeceased ? '#ef4444' : 'hsl(var(--card))'} stroke="currentColor" className="text-foreground" strokeWidth="2.5" />
          )}

          {node.gender === 'pet' && (
            <g transform="scale(0.85) translate(5, 5)">
              <polygon points={`${half},0 ${size},${half} ${half},${size} 0,${half}`} fill="#fef08a" stroke="currentColor" className="text-foreground" strokeWidth="2" />
              <text x={half} y={half + 4} textAnchor="middle" fontSize="14">🐾</text>
            </g>
          )}

          {/* Deceased 'X' Marking */}
          {node.isDeceased && node.gender !== 'miscarriage' && (
            <g stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round">
              <line x1="4" y1="4" x2={size - 4} y2={size - 4} />
              <line x1={size - 4} y1="4" x2="4" y2={size - 4} />
            </g>
          )}
        </g>

      {/* Top-left Primary Caregiver Badge */}
      {node.isPrimaryCaregiver && (
        <g transform="translate(0, 0)">
          <circle cx="0" cy="0" r="9.5" fill="#10b981" stroke="hsl(var(--card))" strokeWidth="1.5" />
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="white"
            transform="translate(-4, -4) scale(0.33)"
          />
        </g>
      )}

      {/* Top-right Decision Maker Badge */}
      {node.isDecisionMaker && (
        <g transform={`translate(${size}, 0)`}>
          <circle cx="0" cy="0" r="9.5" fill="#6366f1" stroke="hsl(var(--card))" strokeWidth="1.5" />
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="white"
            transform="translate(-4.5, -4.5) scale(0.38)"
          />
        </g>
      )}

        {/* Quick Connector Drag Handle */}
        <circle
          cx={half}
          cy={-10}
          r="6"
          fill="hsl(var(--primary))"
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair"
          onClick={(e) => {
            e.stopPropagation();
            setConnectingSourceId(node.id);
          }}
        />

        {/* Text Labels below Node */}
        <g transform={`translate(${half}, ${size + 16})`}>
          <text x="0" y="0" textAnchor="middle" fill="currentColor" className="fill-foreground text-xs font-bold font-sans">
            {node.label}
          </text>
          <text x="0" y="14" textAnchor="middle" fill="currentColor" className="fill-muted-foreground text-[10px] font-sans">
            {node.age ? `${node.age} yrs` : ''}
            {node.birthYear ? ` (${node.birthYear}${node.deathYear ? `-${node.deathYear}` : ''})` : ''}
          </text>
          
          {/* Relationship designation if set */}
          {node.relationshipToPatient && (
            <text x="0" y="26" textAnchor="middle" fill="currentColor" className="fill-muted-foreground text-[9px] italic font-sans">
              ({node.relationshipToPatient})
            </text>
          )}

          {/* Primary Caregiver status text */}
          {node.isPrimaryCaregiver && (
            <text x="0" y={node.relationshipToPatient ? 36 : 26} textAnchor="middle" fill="#10b981" className="text-[9px] font-bold uppercase tracking-wider font-sans">
              Primary Caregiver
            </text>
          )}

          {/* Decision Maker status text */}
          {node.isDecisionMaker && (
            <text x="0" y={(node.relationshipToPatient ? 36 : 26) + (node.isPrimaryCaregiver ? 10 : 0)} textAnchor="middle" fill="#6366f1" className="text-[9px] font-bold uppercase tracking-wider font-sans">
              Decision Maker
            </text>
          )}
        </g>
      </g>
    );
  };

  const renderHouseholdBoundary = (path, pathIdx) => {
    if (!path || path.length <= 1) return null;
    const pathData = path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    
    let topPoint = path[0];
    path.forEach(p => {
      if (p.y < topPoint.y) topPoint = p;
    });

    const isSelected = selectedLoopIdx === pathIdx;
    const activeColor = isSelected ? '#3b82f6' : '#f59e0b';

    return (
      <g key={pathIdx}>
        {/* Shaded inside area for translation (moving) */}
        <path
          d={pathData}
          fill={isSelected ? "rgba(59, 130, 246, 0.05)" : "rgba(245, 158, 11, 0.04)"}
          stroke="none"
          className="cursor-move pointer-events-auto"
          onMouseDown={(e) => handleBoundaryFillMouseDown(e, pathIdx)}
        />
        {/* Dotted visible border path */}
        <path
          d={pathData}
          fill="none"
          stroke={activeColor}
          strokeWidth={isSelected ? "3" : "2"}
          strokeDasharray="6,4"
          className="pointer-events-none"
        />
        {/* Thick transparent hit-target path for scaling (expanding/shrinking) */}
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
          className="cursor-nwse-resize pointer-events-auto"
          onMouseDown={(e) => handleBoundaryPathMouseDown(e, pathIdx)}
        />
        
        {/* Label box, also draggable for moving */}
        <g 
          transform={`translate(${topPoint.x}, ${topPoint.y - 12})`} 
          className="cursor-move pointer-events-auto"
          onMouseDown={(e) => handleBoundaryFillMouseDown(e, pathIdx)}
        >
          <rect x="-55" y="-8" width="110" height="15" rx="3" fill="hsl(var(--card))" stroke={activeColor} strokeWidth="1" />
          <text x="0" y="2" textAnchor="middle" fill={activeColor} fontSize="8" fontWeight="bold" className="font-sans pointer-events-none">
            Staying with Patient
          </text>
        </g>

        {/* Control Vertices (Handles) - Only show when selected */}
        {isSelected && path.slice(0, path.length - 1).map((p, vIdx) => (
          <g key={vIdx} className="pointer-events-auto">
            {/* Transparent larger hitbox circle */}
            <circle
              cx={p.x}
              cy={p.y}
              r="12"
              fill="transparent"
              className="cursor-move"
              onMouseDown={(e) => handleVertexMouseDown(e, pathIdx, vIdx)}
            />
            {/* Visual small handle circle */}
            <circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill="hsl(var(--background))"
              stroke={activeColor}
              strokeWidth="1.5"
              className="transition-transform duration-100 hover:scale-125 pointer-events-none"
            />
          </g>
        ))}
      </g>
    );
  };

  const renderAutoHouseholdBoundary = () => {
    // Fall back to automatic bounding box enclosing nodes with isBeneficiary === true
    const beneficiaries = nodes.filter(n => n.isBeneficiary);
    if (beneficiaries.length === 0) return null;

    const size = 60;
    const padding = 35;

    const xs = beneficiaries.map(n => n.x);
    const ys = beneficiaries.map(n => n.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rectWidth = maxX - minX + size + 2 * padding;
    const rectHeight = maxY - minY + size + 2 * padding;
    const rxVal = Math.min(40, rectWidth / 2, rectHeight / 2);

    return (
      <g className="pointer-events-none">
        <rect
          x={minX - padding}
          y={minY - padding}
          width={rectWidth}
          height={rectHeight}
          rx={rxVal}
          ry={rxVal}
          fill="rgba(245, 158, 11, 0.04)"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="6,4"
        />
        <g transform={`translate(${minX - padding + 20}, ${minY - padding})`}>
          <rect x="-4" y="-8" width="110" height="15" rx="3" fill="hsl(var(--card))" stroke="#f59e0b" strokeWidth="1" />
          <text x="51" y="2" textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="bold" className="font-sans">
            Staying with Patient
          </text>
        </g>
      </g>
    );
  };

  const renderCurrentDrawingPath = () => {
    if (!isDrawingMode || currentPath.length < 2) return null;
    const pathData = currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return (
      <path
        d={pathData}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeDasharray="4,4"
        className="pointer-events-none"
      />
    );
  };

  const downloadAsImage = () => {
    const svgEl = document.querySelector('#canvas-bg');
    if (!svgEl) return;

    // 1. Calculate the bounding box of the actual content
    const padding = 50;
    const nodeSize = 60;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);

    if (householdPaths && householdPaths.length > 0) {
      householdPaths.forEach(path => {
        xs.push(...path.map(p => p.x));
        ys.push(...path.map(p => p.y));
      });
    }

    let minX = 0, maxX = 800, minY = 0, maxY = 500;
    if (xs.length > 0 && ys.length > 0) {
      minX = Math.min(...xs) - padding;
      maxX = Math.max(...xs) + nodeSize + padding;
      minY = Math.min(...ys) - padding;
      maxY = Math.max(...ys) + nodeSize + 80 + padding; // Extra padding for text labels below node
    }

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Clone SVG to modify style variables for standalone image export
    const svgClone = svgEl.cloneNode(true);

    // Resolve basic HSL variables and classes so they render correctly in standalone image
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = '#ffffff'; // Always use a clean white background for printed/downloaded images
    const textColor = '#0f172a'; // Slate-900 for high-contrast readability
    const mutedTextColor = '#475569'; // Slate-600
    const borderColor = '#cbd5e1'; // Slate-300

    // Set cloned SVG viewBox to crop exactly to the content region
    svgClone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    svgClone.setAttribute('width', width);
    svgClone.setAttribute('height', height);
    svgClone.style.width = `${width}px`;
    svgClone.style.height = `${height}px`;
    svgClone.style.background = bgColor;
    svgClone.style.backgroundImage = 'none'; // Remove dynamic grid pattern

    // Replace CSS variables, classes, and currentColor with absolute colors in the clone
    svgClone.querySelectorAll('*').forEach(el => {
      // Remove panning/zoom translate group and set to identity so viewBox does the positioning
      if (el.tagName === 'g' && el.getAttribute('transform')?.includes('translate(') && el.getAttribute('transform')?.includes('scale(')) {
        el.removeAttribute('transform');
      }

      if (el.getAttribute('stroke') === 'currentColor') {
        el.setAttribute('stroke', textColor);
      }
      if (el.getAttribute('fill') === 'currentColor') {
        el.setAttribute('fill', textColor);
      }

      if (el.getAttribute('fill') === 'hsl(var(--card))') {
        el.setAttribute('fill', '#ffffff');
      }
      if (el.getAttribute('stroke') === 'hsl(var(--border))') {
        el.setAttribute('stroke', borderColor);
      }
      if (el.getAttribute('fill') === 'hsl(var(--border))') {
        el.setAttribute('fill', borderColor);
      }
      if (el.getAttribute('stroke') === 'hsl(var(--primary))') {
        el.setAttribute('stroke', '#3b82f6');
      }

      const className = el.getAttribute('class') || '';
      if (className.includes('text-foreground')) {
        el.setAttribute('stroke', textColor);
      }
      if (className.includes('fill-foreground')) {
        el.setAttribute('fill', textColor);
      }
      if (className.includes('fill-muted-foreground')) {
        el.setAttribute('fill', mutedTextColor);
      }
      if (className.includes('text-muted-foreground')) {
        el.setAttribute('stroke', mutedTextColor);
      }

      // Hide the draw handles, connectors, and active selection ring
      if (className.includes('cursor-crosshair') || className.includes('animate-pulse') || el.id === 'connecting-ring') {
        el.style.display = 'none';
      }
    });

    // 3. Serialize and Draw onto Canvas
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 2x Scaling for high resolution output
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = `genogram_${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };

    img.src = url;
  };

  return (
    <div className="w-full flex flex-col border border-border rounded-xl bg-background text-foreground overflow-hidden select-none">
      {/* Genogram Toolbar */}
      <div className="h-12 bg-muted/20 border-b border-border px-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold tracking-wide flex items-center gap-1.5">
              Interactive Genogram Builder
            </h5>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={autoLayout}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-background hover:bg-muted border border-border text-foreground rounded-lg transition"
            title="Auto-organize into generational tiers"
          >
            <Layout className="w-3 h-3 text-primary" />
            <span>Auto Layout</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNodes(DEFAULT_GENOGRAM.nodes);
              setEdges(DEFAULT_GENOGRAM.edges);
              setHouseholdPaths([]);
              setCustomBeneficiaryCount(null);
              triggerChange(DEFAULT_GENOGRAM.nodes, DEFAULT_GENOGRAM.edges, [], null);
              setPan({ x: 30, y: 30 });
              setZoom(0.9);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-background hover:bg-muted border border-border text-foreground rounded-lg transition"
            title="Reset to Proband node"
          >
            <RefreshCw className="w-3 h-3 text-emerald-500" />
            <span>Reset</span>
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            type="button"
            onClick={downloadAsImage}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
            title="Download diagram as PNG image"
          >
            <Camera className="w-3 h-3" />
            <span>Download Image</span>
          </button>

          <button
            type="button"
            onClick={exportJSON}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-primary text-primary-foreground rounded-lg transition hover:bg-primary/90"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          <label className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-background hover:bg-muted border border-border text-foreground rounded-lg transition cursor-pointer">
            <Upload className="w-3 h-3" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={importJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex h-[480px] relative overflow-hidden bg-background">
        {/* Left Side Drawer Control Panel */}
        <div className={`w-72 bg-muted/10 border-r border-border flex flex-col z-10 transition-all duration-300 ${isSidebarOpen ? 'ml-0' : '-ml-72'}`}>
          {/* Navigation Tabs */}
          <div className="flex border-b border-border bg-muted/20 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition ${
                activeTab === 'add' ? 'bg-background text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus className="w-3 h-3" /> Add Symbols
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition ${
                activeTab === 'inspector' ? 'bg-background text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="w-3 h-3" /> Inspector
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* TAB 1: ADD SYMBOLS & LINES */}
            {activeTab === 'add' && (
              <>
                <div className="space-y-2">
                  <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Person Symbols
                  </h6>
                  <div className="grid grid-cols-2 gap-1.5">
                    {GENDER_OPTIONS.map((g) => {
                      const IconComp = g.icon;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => addPersonNode(g.id)}
                          className="flex items-center space-x-2 p-2 bg-background hover:bg-muted border border-border rounded-lg transition text-left group"
                        >
                          <div className="p-1 rounded bg-muted group-hover:bg-primary/10 group-hover:text-primary transition">
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-foreground">{g.label}</div>
                            <div className="text-[9px] text-muted-foreground">{g.shape}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-border">
                  <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" /> Connection Type
                  </h6>
                  <p className="text-[9px] text-muted-foreground">Click dot on source node to link:</p>
                  
                  <div className="space-y-1">
                    {RELATIONSHIP_TYPES.map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => setActiveEdgeType(rel.id)}
                        className={`w-full flex items-center justify-between p-1.5 rounded border text-[11px] transition ${
                          activeEdgeType === rel.id
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span>{rel.icon}</span>
                          <span>{rel.label}</span>
                        </div>
                        <div className="w-6 h-0.5 rounded" style={{ backgroundColor: rel.stroke }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-border">
                  <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-500" /> Household Boundary
                  </h6>
                  <p className="text-[9px] text-muted-foreground">Enclose people staying with the patient:</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrawingMode(!isDrawingMode)}
                      className={`flex items-center justify-center space-x-1.5 p-2 rounded-lg border text-[11px] font-medium transition ${
                        isDrawingMode
                          ? 'bg-amber-500/20 border-amber-500 text-amber-600 font-bold'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>✏️</span>
                      <span>{isDrawingMode ? 'Drawing...' : 'Free Draw Loop'}</span>
                    </button>

                    {(householdPaths.length > 0 || nodes.some(n => n.isBeneficiary)) && (
                      <button
                        type="button"
                        onClick={() => {
                          setHouseholdPaths([]);
                          const clearedNodes = nodes.map(n => ({ ...n, isBeneficiary: false }));
                          setNodes(clearedNodes);
                          triggerChange(clearedNodes, edges, []);
                        }}
                        className="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-medium transition"
                      >
                        <span>🗑️</span>
                        <span>Clear Loop</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: PROPERTIES INSPECTOR */}
            {activeTab === 'inspector' && (
              <div className="space-y-3">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Properties
                      </span>
                      <button
                        type="button"
                        onClick={deleteSelected}
                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-muted rounded transition"
                        title="Delete Person"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Name / Label</label>
                      <input
                        type="text"
                        value={selectedNode.label || ''}
                        onChange={(e) => updateSelectedNode('label', e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Gender Symbol</label>
                      <select
                        value={selectedNode.gender || 'male'}
                        onChange={(e) => updateSelectedNode('gender', e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">Age</label>
                        <input
                          type="text"
                          value={selectedNode.age || ''}
                          onChange={(e) => updateSelectedNode('age', e.target.value)}
                          className="w-full mt-0.5 px-1 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                          placeholder="e.g. 45"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">Birth Yr</label>
                        <input
                          type="text"
                          value={selectedNode.birthYear || ''}
                          onChange={(e) => updateSelectedNode('birthYear', e.target.value)}
                          className="w-full mt-0.5 px-1 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                          placeholder="1996"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">Death Yr</label>
                        <input
                          type="text"
                          value={selectedNode.deathYear || ''}
                          onChange={(e) => updateSelectedNode('deathYear', e.target.value)}
                          disabled={!selectedNode.isDeceased}
                          className="w-full mt-0.5 px-1 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-40"
                          placeholder="2020"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-border">
                      <label className="flex items-center justify-between cursor-pointer p-1.5 bg-background border border-border rounded hover:bg-muted">
                        <span className="text-[11px] text-foreground">Deceased (Mark with X)</span>
                        <input
                          type="checkbox"
                          checked={selectedNode.isDeceased || false}
                          onChange={(e) => updateSelectedNode('isDeceased', e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer p-1.5 bg-background border border-border rounded hover:bg-muted">
                        <span className="text-[11px] text-foreground">Index Patient (Double Outline)</span>
                        <input
                          type="checkbox"
                          checked={selectedNode.isProband || false}
                          onChange={(e) => updateSelectedNode('isProband', e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-primary"
                        />
                      </label>
                    </div>

                    {!selectedNode.isProband && (
                      <div className="space-y-1.5 pt-1.5 border-t border-border">
                        <label className="flex items-center justify-between cursor-pointer p-1.5 bg-background border border-border rounded hover:bg-muted">
                          <span className="text-[11px] text-foreground">Staying with Patient (Beneficiary)</span>
                          <input
                            type="checkbox"
                            checked={selectedNode.isBeneficiary || false}
                            onChange={(e) => updateSelectedNode('isBeneficiary', e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-primary"
                          />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer p-1.5 bg-background border border-border rounded hover:bg-muted">
                          <span className="text-[11px] text-foreground">Primary Caregiver</span>
                          <input
                            type="checkbox"
                            checked={selectedNode.isPrimaryCaregiver || false}
                            onChange={(e) => updateSelectedNode('isPrimaryCaregiver', e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-primary"
                          />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer p-1.5 bg-background border border-border rounded hover:bg-muted">
                          <span className="text-[11px] text-foreground">Decision Maker</span>
                          <input
                            type="checkbox"
                            checked={selectedNode.isDecisionMaker || false}
                            onChange={(e) => updateSelectedNode('isDecisionMaker', e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-primary"
                          />
                        </label>

                        <div className="pt-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Relationship to Index Patient</label>
                          <input
                            type="text"
                            value={selectedNode.relationshipToPatient || ''}
                            onChange={(e) => updateSelectedNode('relationshipToPatient', e.target.value)}
                            placeholder="e.g. Spouse, Son, Daughter, Brother"
                            className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 pt-1.5 border-t border-border">
                      <label className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                        <span>Clinical Attributes</span>
                        <span className="text-[9px] text-primary">
                          {(selectedNode.conditions || []).length} selected
                        </span>
                      </label>
                      <div className="space-y-1">
                        {Object.entries(CONDITION_COLORS).map(([key, meta]) => {
                          const isSelected = (selectedNode.conditions || []).includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleCondition(key)}
                              className={`w-full flex items-center justify-between p-1.5 rounded text-xs transition border ${
                                isSelected
                                  ? 'bg-muted border-primary text-foreground font-semibold'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                                <span className="text-[11px]">{meta.icon} {meta.label}</span>
                              </div>
                              {isSelected && <Check className="w-3 h-3 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-border">
                      <label className="text-[10px] font-medium text-muted-foreground">Notes</label>
                      <textarea
                        rows={2}
                        value={selectedNode.notes || ''}
                        onChange={(e) => updateSelectedNode('notes', e.target.value)}
                        placeholder="Add medical history notes..."
                        className="w-full mt-0.5 p-1.5 bg-background border border-border rounded text-[11px] text-foreground focus:outline-none focus:border-primary resize-none"
                      />
                    </div>
                  </div>
                ) : selectedEdge ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Relationship
                      </span>
                      <button
                        type="button"
                        onClick={deleteSelected}
                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-muted rounded transition"
                        title="Delete Line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Relationship Type</label>
                      <select
                        value={selectedEdge.type || 'marriage'}
                        onChange={(e) => updateSelectedEdge('type', e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        {RELATIONSHIP_TYPES.map((rel) => (
                          <option key={rel.id} value={rel.id}>{rel.icon} {rel.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Year / Custom Label</label>
                      <input
                        type="text"
                        value={selectedEdge.label || ''}
                        onChange={(e) => updateSelectedEdge('label', e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                        placeholder="e.g. m. 2004, div. 2012"
                      />
                    </div>

                    {(selectedEdge.type === 'parentChild' || selectedEdge.type === 'adopted') && (
                      <div className="mt-3">
                        <label className="text-[10px] font-medium text-muted-foreground">Connection Anchor</label>
                        <select
                          value={selectedEdge.connectToMidpoint !== false ? 'midpoint' : 'node'}
                          onChange={(e) => updateSelectedEdge('connectToMidpoint', e.target.value === 'midpoint')}
                          className="w-full mt-0.5 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                        >
                          <option value="midpoint">Parents' Marriage Midpoint</option>
                          <option value="node">Direct Node (Single Parent)</option>
                        </select>
                      </div>
                    )}


                  </div>
                ) : selectedLoopIdx !== null && householdPaths[selectedLoopIdx] ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-500" /> Household Loop
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedPaths = householdPaths.filter((_, idx) => idx !== selectedLoopIdx);
                          setHouseholdPaths(updatedPaths);
                          setSelectedLoopIdx(null);

                          // Recalculate enclosed nodes
                          const updatedNodes = nodes.map(node => {
                            if (node.isProband) return node;
                            const center = { x: node.x + 30, y: node.y + 30 };
                            const isEnclosed = updatedPaths.some(path => isPointInPolygon(center, path));
                            return { ...node, isBeneficiary: isEnclosed };
                          });
                          setNodes(updatedNodes);
                          triggerChange(updatedNodes, edges, updatedPaths);
                        }}
                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-muted rounded transition"
                        title="Delete Loop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="bg-muted/35 rounded-lg p-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loop Number</span>
                        <span className="font-semibold text-foreground">#{selectedLoopIdx + 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">People Enclosed</span>
                        <span className="font-semibold text-foreground">
                          {nodes.filter(n => {
                            if (n.isProband) return false;
                            const center = { x: n.x + 30, y: n.y + 30 };
                            return isPointInPolygon(center, householdPaths[selectedLoopIdx]);
                          }).length}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground space-y-1">
                    <Info className="w-6 h-6 mx-auto text-muted-foreground/60" />
                    <p className="text-[11px]">Click on any Person symbol, Relationship line, or Boundary loop to view and edit properties.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Interactive SVG Canvas */}
        <div
          ref={canvasRef}
          className={`flex-1 h-full relative overflow-hidden ${
            isDrawingMode
              ? 'cursor-crosshair'
              : isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Connecting Banner Overlay */}
          {connectingSourceId && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center space-x-1.5 animate-bounce">
              <Link2 className="w-3.5 h-3.5" />
              <span>Click target person node to create relationship line...</span>
              <button type="button" onClick={() => setConnectingSourceId(null)} className="ml-1.5 underline text-[9px] hover:text-black">Cancel</button>
            </div>
          )}

          {/* Total Beneficiaries Indicator Box */}
          <div className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl p-2 px-3 shadow-medium flex items-center space-x-2">
            <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Total Beneficiaries</div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={customBeneficiaryCount !== null && customBeneficiaryCount !== undefined ? customBeneficiaryCount : nodes.filter(n => n.isBeneficiary || n.isProband).length}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = val === '' ? null : Number(val);
                    setCustomBeneficiaryCount(num);
                    triggerChange(nodes, edges, householdPaths, num);
                  }}
                  className="w-12 h-6 px-1 text-xs font-bold text-center bg-background border border-border rounded text-foreground focus:outline-none focus:border-amber-500"
                  min="0"
                />
                {customBeneficiaryCount !== null && customBeneficiaryCount !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBeneficiaryCount(null);
                      triggerChange(nodes, edges, householdPaths, null);
                    }}
                    title="Reset to auto-calculated count"
                    className="text-[9px] text-amber-500 hover:text-amber-600 font-semibold uppercase tracking-wider ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SVG Diagram Board */}
          <svg
            id="canvas-bg"
            className="w-full h-full bg-background"
            style={{
              backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Household Boundaries */}
              {householdPaths.length > 0 
                ? householdPaths.map((path, idx) => renderHouseholdBoundary(path, idx))
                : renderAutoHouseholdBoundary()
              }

              {/* Real-time Drawing Path */}
              {renderCurrentDrawingPath()}

              {/* Edges & Nodes */}
              <g className={activeLoopAction ? 'pointer-events-none' : ''}>
                {edges.map(renderEdge)}
                {nodes.map(renderNode)}
              </g>
            </g>
          </svg>

          {/* Canvas Zoom Toolbar */}
          <div className="absolute bottom-3 left-3 bg-card border border-border rounded-lg p-0.5 flex items-center space-x-0.5 shadow-soft">
            <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-1 hover:bg-muted rounded text-foreground">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-1 hover:bg-muted rounded text-foreground">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Collapsible Clinical Legend */}
          <div className="absolute bottom-3 right-3 z-10">
            {showLegend ? (
              <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-2.5 shadow-medium w-48 max-h-60 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <span className="text-[10px] font-bold text-foreground flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-primary" /> Key
                  </span>
                  <button type="button" onClick={() => setShowLegend(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[9px]">
                  <div className="font-semibold text-muted-foreground uppercase text-[8px] tracking-wider">Symbols</div>
                  <div className="grid grid-cols-2 gap-1 text-foreground">
                    <div className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-foreground" /> Male</div>
                    <div className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-foreground" /> Female</div>
                    <div className="flex items-center gap-1"><X className="w-2.5 h-2.5 text-red-500" /> Deceased</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 border border-sky-400 rounded-sm" /> Proband</div>
                  </div>

                  <div className="font-semibold text-muted-foreground uppercase text-[8px] tracking-wider pt-1 border-t border-border">Household & Roles</div>
                  <div className="space-y-1 text-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 border border-dashed border-amber-500 rounded bg-amber-500/10" />
                      <span>Staying with Patient</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[7px]">❤️</span>
                      <span>Primary Caregiver</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-indigo-500 text-white text-[7px]">⭐</span>
                      <span>Decision Maker</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLegend(true)}
                className="bg-card border border-border hover:bg-muted text-foreground px-2.5 py-1 rounded-lg text-[10px] font-medium shadow-soft flex items-center gap-1 transition"
              >
                <HelpCircle className="w-3 h-3 text-primary" />
                <span>Show Key</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
