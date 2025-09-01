/**
 * 电力系统潮流可视化主脚本 - 完整版本
 * 包含所有功能：数据管理、可视化、交互、计算等
 * 使用D3.js实现电力网络可视化与交互
 */
/**
 * PyPower数据适配器类 - 处理不同PyPower案例的数据格式转换
 */
class PyPowerDataAdapter {
  constructor() {
    // 支持的PyPower案例类型
    this.supportedCases = ['case9', 'case14', 'case30', 'case39', 'case57', 'case118'];
    
    // 不同案例的节点类型映射规则
    this.busTypeMapping = {
      1: 'slack',    // 平衡节点
      2: 'pv', // PV节点（电压控制节点）
      3: 'load'       // 负荷节点（PQ节点）
    };
  }
  
  /**
   * 检测数据来源的案例类型
   * @param {Object} node - 节点数据
   * @param {Object} caseType - 案例类型
   * @returns {string} 节点类型
   */

  detectCaseType(data) {
    if (!data || !data.nodes) return 'unknown';
    
    const nodeCount = data.nodes.length;
    
    // 根据节点数量推断案例类型
    if (nodeCount <= 9) return 'case9';
    if (nodeCount <= 14) return 'case14';
    if (nodeCount <= 30) return 'case30';
    if (nodeCount <= 39) return 'case39';
    if (nodeCount <= 57) return 'case57';
    if (nodeCount <= 118) return 'case118';
    
  
    
    return 'custom';
  }
  
  /**
   * 标准化节点数据格式
   * @param {Array} nodes - 原始节点数据
   * @param {string} caseType - 案例类型
   * @returns {Array} 标准化后的节点数据
   */
  normalizeNodes(nodes, caseType) {
    return nodes.map(node => {
      const normalizedNode = {
        id: node.id || `bus${node.bus_i || node.bus || Math.random().toString(36).substr(2, 9)}`,
        voltage: node.voltage || node.vm || 1.0,
        angle: node.angle || node.va || 0.0,
        active_power: node.active_power || node.pd || 0,
        reactive_power: node.reactive_power || node.qd || 0,
        type: this.determineNodeType(node, caseType)
      };
      
      // 添加坐标信息（如果没有的话）
      if (!normalizedNode.x || !normalizedNode.y) {
        const coords = this.generateNodeCoordinates(normalizedNode.id, caseType, nodes.length);
        normalizedNode.x = coords.x;
        normalizedNode.y = coords.y;
      }
      
      return normalizedNode;
    });
  }
  
  /**
   * 标准化连接线数据格式
   * @param {Array} links - 原始连接线数据
   * @param {string} caseType - 案例类型
   * @returns {Array} 标准化后的连接线数据
   */
  normalizeLinks(links, caseType) {
    return links.map(link => {
      return {
        source: link.source || link.fbus || link.from,
        target: link.target || link.tbus || link.to,
        resistance: link.resistance || link.r || 0.01,
        reactance: link.reactance || link.x || 0.05,
        active_power: link.active_power || link.pf || 0,
        reactive_power: link.reactive_power || link.qf || 0
      };
    });
  }
  
  /**
   * 确定节点类型
   * @param {Object} node - 节点数据
   * @param {string} caseType - 案例类型
   * @returns {string} 节点类型
   */
  determineNodeType(node, caseType) {
    // 优先使用明确的类型标识
    if (node.type) {
      return node.type;
    }
    
    // 根据bus_type判断
    if (node.bus_type !== undefined) {
      return this.busTypeMapping[node.bus_type] || 'load';
    }
    
    // 根据功率特征判断
    if (node.active_power > 0 && node.voltage !== undefined) {
      return 'pv'; // PV节点：控制电压，输出有功功率
    } else if (node.active_power > 0) {
      return 'generator'; // 发电机节点：只输出功率
    } else if (node.active_power < 0) {
      return 'load';
    }
    
    // 默认为负荷节点
    return 'load';
  }
  
  /**
   * 为节点生成坐标
   * @param {string} nodeId - 节点ID
   * @param {string} caseType - 案例类型
   * @param {number} totalNodes - 总节点数
   * @returns {Object} 坐标对象 {x, y}
   */
  generateNodeCoordinates(nodeId, caseType, totalNodes) {
    // 为不同案例预定义坐标布局
    const predefinedLayouts = {
      case9: {
        'bus1': {x: 100, y: 150},
        'bus2': {x: 200, y: 100},
        'bus3': {x: 200, y: 200},
        'bus4': {x: 300, y: 50},
        'bus5': {x: 300, y: 150},
        'bus6': {x: 300, y: 250},
        'bus7': {x: 400, y: 100},
        'bus8': {x: 400, y: 200},
        'bus9': {x: 500, y: 150}
      },
      case14: {
        'bus1': {x: 100, y: 200},
        'bus2': {x: 200, y: 150},
        'bus3': {x: 200, y: 250},
        'bus4': {x: 300, y: 100},
        'bus5': {x: 300, y: 200},
        'bus6': {x: 300, y: 300},
        'bus7': {x: 400, y: 150},
        'bus8': {x: 400, y: 250},
        'bus9': {x: 500, y: 100},
        'bus10': {x: 500, y: 200},
        'bus11': {x: 500, y: 300},
        'bus12': {x: 600, y: 150},
        'bus13': {x: 600, y: 250},
        'bus14': {x: 700, y: 200}
      },
      case30: {
        // 为30节点系统生成环形布局
        ...this.generateCircularLayout(30, 400, 300, 80)
      }
    };
    
    // 如果有预定义布局，直接返回
    if (predefinedLayouts[caseType] && predefinedLayouts[caseType][nodeId]) {
      return predefinedLayouts[caseType][nodeId];
    }
    
    // 生成环形布局作为默认
    return this.generateCircularLayoutForNode(nodeId, totalNodes, 400, 300, 80);
  }
  
  /**
   * 生成环形布局
   * @param {number} nodeCount - 节点数量
   * @param {number} centerX - 中心X坐标
   * @param {number} centerY - 中心Y坐标
   * @param {number} radius - 半径
   * @returns {Object} 节点坐标映射
   */
  generateCircularLayout(nodeCount, centerX, centerY, radius) {
    const layout = {};
    for (let i = 1; i <= nodeCount; i++) {
      const angle = (2 * Math.PI * (i - 1)) / nodeCount;
      layout[`bus${i}`] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    }
    return layout;
  }
  
  /**
   * 为单个节点生成环形布局坐标
   * @param {string} nodeId - 节点ID
   * @param {number} totalNodes - 总节点数
   * @param {number} centerX - 中心X坐标
   * @param {number} centerY - 中心Y坐标
   * @param {number} radius - 半径
   * @returns {Object} 坐标对象
   */
  generateCircularLayoutForNode(nodeId, totalNodes, centerX, centerY, radius) {
    const nodeIndex = parseInt(nodeId.replace('bus', '')) || 1;
    const angle = (2 * Math.PI * (nodeIndex - 1)) / totalNodes;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }
  
  /**
   * 验证数据格式
   * @param {Object} data - 数据对象
   * @returns {boolean} 是否有效
   */
  validateData(data) {
    if (!data) return false;
    if (!data.nodes || !Array.isArray(data.nodes)) return false;
    if (!data.links || !Array.isArray(data.links)) return false;
    
    // 验证节点数据
    for (const node of data.nodes) {
      if (!node.id) return false;
    }
    
    // 验证连接线数据
    for (const link of data.links) {
      if (!link.source || !link.target) return false;
    }
    
    return true;
  }
  
  /**
   * 转换数据格式
   * @param {Object} rawData - 原始数据
   * @returns {Object} 转换后的数据
   */
  convertData(rawData) {
    if (!this.validateData(rawData)) {
      throw new Error('数据格式无效');
    }
    
    const caseType = this.detectCaseType(rawData);
    
    return {
      caseType: caseType,
      nodes: this.normalizeNodes(rawData.nodes, caseType),
      links: this.normalizeLinks(rawData.links, caseType),
      metadata: {
        originalFormat: 'pypower',
        convertedAt: new Date().toISOString(),
        nodeCount: rawData.nodes.length,
        linkCount: rawData.links.length
      }
    };
  }
}
class PowerFlowVisualization {
  constructor() {
    // 全局状态管理
    this.state = {
      nodes: [],
      links: [],
      simulation: null,
      svg: null,
      nodeElements: null,
      linkElements: null,
      selectedNode: null,
      selectedLink: null,
      voltageChart: null,
      powerFlowChart: null,
      transform: d3.zoomIdentity,
      tooltip: null,
      animationFrame: null,
      isSimulationActive: false,
      fixedChartHeight: 200,
      linkCreationMode: false,
      selectedLinkSource: null,
      tempLinkLine: null,
      dataAdapter: new PyPowerDataAdapter()
    };

    this.bindMethods(); // 初始化应用
    this.init();
  } /**

     * 绑定方法上下文，避免this指向问题

     */

  bindMethods() {
    this.updateSimulation = this.updateSimulation.bind(this);
    this.handleZoom = this.handleZoom.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.handleNodeMouseOver = this.handleNodeMouseOver.bind(this);
    this.handleNodeMouseOut = this.handleNodeMouseOut.bind(this);
    this.handleNodeClick = this.handleNodeClick.bind(this);
    this.handleLinkMouseOver = this.handleLinkMouseOver.bind(this);
    this.handleLinkMouseOut = this.handleLinkMouseOut.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.startLinkCreation = this.startLinkCreation.bind(this);
    this.cancelLinkCreation = this.cancelLinkCreation.bind(this);
    this.handleNodeClickForLinkCreation = this.handleNodeClickForLinkCreation.bind(this);
    this.addLink = this.addLink.bind(this);
    this.deleteSelectedLink = this.deleteSelectedLink.bind(this);
  } /**

     * 初始化整个应用

     */

  async init() {
    try {
      // 初始化工具提示
      this.initTooltip(); // 加载电网数据
      await this.loadGridData(); // 初始化可视化组件
      this.initVisualization(); // 初始化图表
      this.initCharts(); // 更新统计信息
      this.updateStatistics(); // 绑定事件处理
      this.bindEvents();
      console.log('电力潮流可视化应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      this.showErrorNotification('初始化失败: ' + error.message);
    }
  } /**

     * 从API加载电网数据

     */

    /**
   * 从API加载电网数据
   */
  async loadGridData() {
    try {
      const response = await fetch('/api/grid-data');
      if (!response.ok) throw new Error('网络请求失败');
      
      const rawData = await response.json();
      
      // 使用数据适配器转换数据格式
      const convertedData = this.state.dataAdapter.convertData(rawData);
      
      this.state.nodes = convertedData.nodes;
      this.state.links = convertedData.links;
      
      // 应用案例特定的配置
      this.applyCaseConfig(convertedData.caseType);
      
      console.log('成功加载电网数据:', {
        nodes: this.state.nodes.length,
        links: this.state.links.length,
        caseType: convertedData.caseType
      });
      
    } catch (error) {
      console.error('加载电网数据失败:', error);
      // 使用示例数据回退
      this.useSampleData();
    }
  }
    /**
   * 加载指定案例数据
   * @param {string} caseName - 案例名称
   */
  async loadCaseData(caseName) {
    try {
      const response = await fetch(`/api/load-case`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ case: caseName })
      });
      
      if (!response.ok) throw new Error('网络请求失败');
      
      const rawData = await response.json();
      
      // 使用数据适配器转换数据格式
      const convertedData = this.state.dataAdapter.convertData(rawData);
      
      this.state.nodes = convertedData.nodes;
      this.state.links = convertedData.links;
      
      // 应用案例特定的配置
      this.applyCaseConfig(convertedData.caseType);
      
      // 更新可视化
      this.updateVisualization();
      this.updateCharts();
      this.updateStatistics();
      
      console.log(`成功加载案例 ${caseName}:`, {
        nodes: this.state.nodes.length,
        links: this.state.links.length,
        caseType: convertedData.caseType
      });
      
      this.showSuccessNotification(`已加载案例: ${caseName}`);
      
    } catch (error) {
      console.error(`加载案例 ${caseName} 失败:`, error);
      this.showErrorNotification(`加载案例失败: ${error.message}`);
    }
  }

    /**
   * 应用案例特定配置
   * @param {string} caseType - 案例类型
   */
  applyCaseConfig(caseType) {
    const configs = {
      case9: {
        forceStrength: 0.3,
        linkDistance: 100,
        chargeStrength: -200,
        collisionRadius: 30
      },
      case14: {
        forceStrength: 0.25,
        linkDistance: 80,
        chargeStrength: -150,
        collisionRadius: 25
      },
      case30: {
        forceStrength: 0.2,
        linkDistance: 60,
        chargeStrength: -100,
        collisionRadius: 20
      },
      case39: {
        forceStrength: 0.15,
        linkDistance: 50,
        chargeStrength: -80,
        collisionRadius: 18
      },
      case57: {
        forceStrength: 0.12,
        linkDistance: 40,
        chargeStrength: -120,   // 增加斥力（从-60改为-120）
        collisionRadius: 15
      },
      case118: {
        forceStrength: 0.1,
        linkDistance: 30,
        chargeStrength: -100,   // 增加斥力（从-40改为-100）
        collisionRadius: 12
      },
     
    };
    
    const config = configs[caseType] || configs.case9;
    
    if (this.state.simulation) {
      this.state.simulation
        .force('link')
        .distance(config.linkDistance)
        .strength(config.forceStrength);
      
      this.state.simulation
        .force('charge')
        .strength(config.chargeStrength);
      
      this.state.simulation
        .force('collision')
        .radius(config.collisionRadius);
    }
  }
  /**

     * 使用示例数据（当API加载失败时）

     */

  useSampleData() {
    this.state.nodes = [
      {
        id: 'bus1',
        type: 'generator',
        x: 100,
        y: 150,
        voltage: 1.0,
        angle: 0.0,
        active_power: 100,
        reactive_power: 50,
      },

      {
        id: 'bus2',
        type: 'load',
        x: 300,
        y: 100,
        voltage: 0.98,
        angle: -2.0,
        active_power: -80,
        reactive_power: -30,
      },

      {
        id: 'bus3',
        type: 'load',
        x: 300,
        y: 200,
        voltage: 0.97,
        angle: -3.0,
        active_power: -60,
        reactive_power: -20,
      },

      {
        id: 'bus4',
        type: 'generator',
        x: 500,
        y: 150,
        voltage: 1.02,
        angle: 1.0,
        active_power: 50,
        reactive_power: 20,
      },
    ];

    this.state.links = [
      {
        source: 'bus1',
        target: 'bus2',
        resistance: 0.01,
        reactance: 0.05,
        active_power: 85,
        reactive_power: 35,
      },

      {
        source: 'bus1',
        target: 'bus3',
        resistance: 0.015,
        reactance: 0.06,
        active_power: 75,
        reactive_power: 30,
      },

      {
        source: 'bus2',
        target: 'bus4',
        resistance: 0.012,
        reactance: 0.04,
        active_power: 70,
        reactive_power: 25,
      },

      {
        source: 'bus3',
        target: 'bus4',
        resistance: 0.01,
        reactance: 0.05,
        active_power: 65,
        reactive_power: 20,
      },
    ];

    console.log('使用示例数据');
  } /**

     * 初始化可视化组件

     */

  initVisualization() {
    const container = document.getElementById('power-grid');

    if (!container) {
      throw new Error('找不到可视化容器 #power-grid');
    }

    const width = container.clientWidth;

    const height = container.clientHeight; // 创建SVG容器

    const svgContainer = d3
      .select('#power-grid')

      .append('svg')

      .attr('width', width)

      .attr('height', height)

      .call(d3.zoom().scaleExtent([0.5, 3]).on('zoom', this.handleZoom));

    this.state.svg = svgContainer.append('g'); // 添加箭头标记定义

    this.addArrowheadDefinition(); // 绘制背景网格

    this.drawGrid(width, height); // 初始化力导向图

    this.initForceSimulation(width, height); // 绘制连接线

    this.drawLinks(); // 绘制节点

    this.drawNodes(); // 启动模拟

    this.startSimulation();
  } /**

     * 添加箭头标记定义

     */

  addArrowheadDefinition() {
    this.state.svg
      .append('defs')
      .selectAll('marker')

      .data(['end'])

      .join('marker')

      .attr('id', 'arrowhead')

      .attr('viewBox', '0 0 6 6')

      .attr('refX', 5)

      .attr('refY', 3)

      .attr('markerWidth', 3)

      .attr('markerHeight', 3)

      .attr('orient', 'auto')

      .append('path')

      .attr('d', 'M 0 0 L 6 3 L 0 6 z')

      .attr('fill', '#666');
  } /**

     * 绘制背景网格

     */

  drawGrid(width, height) {
    const gridSize = 40;

    const grid = this.state.svg
      .append('g')

      .attr('class', 'grid')

      .attr('stroke', '#eee')

      .attr('stroke-width', 1); // 水平线

    const horizontalLines = Math.ceil(height / gridSize);

    for (let y = 0; y <= horizontalLines; y++) {
      grid
        .append('line')

        .attr('x1', 0)

        .attr('y1', y * gridSize)

        .attr('x2', width)

        .attr('y2', y * gridSize);
    } // 垂直线

    const verticalLines = Math.ceil(width / gridSize);

    for (let x = 0; x <= verticalLines; x++) {
      grid
        .append('line')

        .attr('x1', x * gridSize)

        .attr('y1', 0)

        .attr('x2', x * gridSize)

        .attr('y2', height);
    }
  } /**

     * 初始化力导向图模拟

     */

  initForceSimulation(width, height) {
    this.state.simulation = d3
      .forceSimulation()

      .nodes(this.state.nodes)

      .force(
        'link',
        d3
          .forceLink()
          .id(d => d.id)
          .distance(100)
          .strength(0.3)
      )

      .force('charge', d3.forceManyBody().strength(-200))

      .force('center', d3.forceCenter(width / 2, height / 2))

      .force('collision', d3.forceCollide().radius(30))

      .velocityDecay(0.9)

      .alphaMin(0.01);

    this.state.simulation.on('tick', () => {
      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
      }

      this.state.animationFrame = requestAnimationFrame(this.updateSimulation);
    });
  } /**
   * 计算自适应线条粗细
   */
  calculateAdaptiveStrokeWidth(activePower) {
    // 返回固定的线条粗细，不再根据输电量大小变化
    return 2;
  } /**
   * 绘制连接线
   */
  drawLinks() {
    this.state.linkElements = this.state.svg
      .append('g')

      .attr('class', 'links')

      .selectAll('line')

      .data(this.state.links)

      .join('line')

      .attr('stroke', '#999')

      .attr('stroke-width', 2)  // 使用固定的线条粗细

      .attr('marker-end', 'url(#arrowhead)')

      .on('mouseover', this.handleLinkMouseOver)

      .on('mouseout', this.handleLinkMouseOut)

      .on('click', this.handleLinkClick);
  } /**

     * 绘制节点

     */

  drawNodes() {
    this.state.nodeElements = this.state.svg
      .append('g')

      .attr('class', 'nodes')

      .selectAll('circle')

      .data(this.state.nodes)

      .join('circle')

      .attr('r', 12)

      .attr('fill', d => this.getNodeColor(d))

      .attr('stroke', '#fff')

      .attr('stroke-width', 2)

      .attr('cursor', 'pointer')

      .call(
        d3
          .drag()

          .on('start', this.handleDragStart)

          .on('drag', this.handleDrag)

          .on('end', this.handleDragEnd)
      )

      .on('mouseover', this.handleNodeMouseOver)

      .on('mouseout', this.handleNodeMouseOut)

      .on('click', this.handleNodeClick);
  } /**

  /**
   * 获取节点颜色
   */
  getNodeColor(d) {
    const colors = {
      slack: '#8b5cf6',      // 平衡节点 - 紫色
      pv: '#3b82f6',         // PV节点 - 蓝色
      generator: '#10b981',   // 发电机节点 - 绿色
      load: '#ef4444'         // 负荷节点 - 红色
    };
    
    return colors[d.type] || '#6b7280';
  }



  getNodeColor(d) {
    const colors = {
      generator: '#3b82f6',

      load: '#ef4444',

      pv: '#3b82f6',

      slack: '#8b5cf6',
    };

    return colors[d.type] || '#6b7280';
  } /**

     * 启动模拟

     */

  startSimulation() {
    if (this.state.isSimulationActive) return;

    this.state.simulation

      .nodes(this.state.nodes)

      .on('tick', () => {
        if (this.state.animationFrame) cancelAnimationFrame(this.state.animationFrame);

        this.state.animationFrame = requestAnimationFrame(this.updateSimulation);
      });

    this.state.simulation
      .force('link')

      .links(this.state.links);

    this.state.simulation.alpha(0.3).restart();

    this.state.isSimulationActive = true;
  } /**

     * 停止模拟

     */

  stopSimulation() {
    if (!this.state.isSimulationActive) return;

    this.state.simulation.stop();

    this.state.isSimulationActive = false;

    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);

      this.state.animationFrame = null;
    }
  } /**

     * 更新模拟状态

     */

  updateSimulation() {
    // 更新连接线位置和箭头方向

    this.state.linkElements

      .attr('x1', d => d.source.x)

      .attr('y1', d => d.source.y)

      .attr('x2', d => {
        const dx = d.target.x - d.source.x;

        const dy = d.target.y - d.source.y;

        const length = Math.sqrt(dx * dx + dy * dy);

        const radius = 12;

        return d.target.x - (dx / length) * radius;
      })

      .attr('y2', d => {
        const dx = d.target.x - d.source.x;

        const dy = d.target.y - d.source.y;

        const length = Math.sqrt(dx * dx + dy * dy);

        const radius = 12;

        return d.target.y - (dy / length) * radius;
      }); // 更新节点位置

    this.state.nodeElements

      .attr('cx', d => d.x)

      .attr('cy', d => d.y);
  } /**

     * 初始化工具提示

     */

  initTooltip() {
    this.state.tooltip = d3
      .select('body')
      .append('div')

      .attr('id', 'tooltip')

      .attr('class', 'absolute bg-white p-3 rounded shadow-lg border border-gray-200 z-10')

      .style('opacity', 0)

      .style('pointer-events', 'none')

      .style('transition', 'opacity 0.2s');
  } /**

     * 初始化图表

     */

  initCharts() {
    // 电压图表

    const voltageCtx = document.getElementById('voltageChart');

    if (voltageCtx) {
      this.state.voltageChart = new Chart(voltageCtx.getContext('2d'), {
        type: 'bar',

        data: {
          labels: this.state.nodes.map(n => n.id),

          datasets: [
            {
              label: '电压 (pu)',

              data: this.state.nodes.map(n => n.voltage),

              backgroundColor: '#4CAF50',

              borderColor: '#45a049',

              borderWidth: 1,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio: false, // 修改为false以填充容器
          // aspectRatio: 2, // 移除宽高比限制
          plugins: {
            legend: {
              display: true,

              position: 'top',
            },
          },

          scales: {
            y: {
              min: 0.95,

              max: 1.05,

              ticks: {
                maxTicksLimit: 5,
              },
            },
          },
        },
      });
    } // 潮流图表

    const flowCtx = document.getElementById('power-flow-chart');

    if (flowCtx) {
      this.state.powerFlowChart = new Chart(flowCtx.getContext('2d'), {
        type: 'bar',

        data: {
          labels: this.state.links.map(l => `${l.source.id || l.source}→${l.target.id || l.target}`),

          datasets: [
            {
              label: '有功潮流',

              data: this.state.links.map(l => l.active_power),

              backgroundColor: '#3b82f6',

              borderColor: '#2563eb',

              borderWidth: 1,
            },
            {
              label: '无功潮流',

              data: this.state.links.map(l => l.reactive_power),

              backgroundColor: '#ef4444',

              borderColor: '#dc2626',

              borderWidth: 1,
            },
          ],
        },

        options: {
          responsive: true,

          maintainAspectRatio: false, // 恢复原始比例
          aspectRatio: 2, // 设置宽高比
          plugins: {
            legend: {
              display: true,

              position: 'top',
            },
          },

          scales: {
            y: {
              title: { text: '功率 (MW/Mvar)' },
            },
          },
        },
      });
    }
  } 
  
  /**
 * 初始化显示切换功能
 */
initDisplayToggle() {
  // 节点电压分布切换
  const voltageToggle = document.getElementById('voltage-display-toggle');
  if (voltageToggle) {
    voltageToggle.addEventListener('change', (e) => {
      this.toggleVoltageDisplay(e.target.checked);
    });
  }
  
  // 线路潮流分布切换
  const powerFlowToggle = document.getElementById('power-flow-display-toggle');
  if (powerFlowToggle) {
    powerFlowToggle.addEventListener('change', (e) => {
      this.togglePowerFlowDisplay(e.target.checked);
    });
  }
}

/**
 * 切换节点电压显示方式
 * @param {boolean} showTable - 是否显示表格
 */
toggleVoltageDisplay(showTable) {
  const chartContainer = document.getElementById('voltage-chart-container');
  const tableContainer = document.getElementById('voltage-table-container');
  
  if (showTable) {
    // 显示表格，隐藏图表
    chartContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    this.updateVoltageTable();
  } else {
    // 显示图表，隐藏表格
    chartContainer.classList.remove('hidden');
    tableContainer.classList.add('hidden');
  }
}

/**
 * 切换线路潮流显示方式
 * @param {boolean} showTable - 是否显示表格
 */
togglePowerFlowDisplay(showTable) {
  const chartContainer = document.getElementById('power-flow-chart-container');
  const tableContainer = document.getElementById('power-flow-table-container');
  
  if (showTable) {
    // 显示表格，隐藏图表
    chartContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    this.updatePowerFlowTable();
  } else {
    // 显示图表，隐藏表格
    chartContainer.classList.remove('hidden');
    tableContainer.classList.add('hidden');
  }
}

/**
 * 更新节点电压表格数据
 */
updateVoltageTable() {
  const tableBody = document.getElementById('voltage-table-body');
  if (!tableBody) return;
  
  // 清空表格
  tableBody.innerHTML = '';
  
  // 按节点ID排序
  const sortedNodes = [...this.state.nodes].sort((a, b) => {
    const aId = parseInt(a.id.replace('bus', '')) || 0;
    const bId = parseInt(b.id.replace('bus', '')) || 0;
    return aId - bId;
  });
  
  // 添加数据行
  sortedNodes.forEach(node => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    // 根据电压值设置颜色
    const voltageColor = this.getVoltageColor(node.voltage);
    
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${node.id}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm ${voltageColor}">${node.voltage.toFixed(3)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${node.angle.toFixed(2)}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * 更新线路潮流表格数据
 */
updatePowerFlowTable() {
  const tableBody = document.getElementById('power-flow-table-body');
  if (!tableBody) return;
  
  // 清空表格
  tableBody.innerHTML = '';
  
  // 添加数据行
  this.state.links.forEach(link => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    const sourceId = link.source.id || link.source;
    const targetId = link.target.id || link.target;
    const lineName = `${sourceId}→${targetId}`;
    
    // 根据功率值设置颜色
    const activePowerColor = link.active_power >= 0 ? 'text-green-600' : 'text-red-600';
    const reactivePowerColor = link.reactive_power >= 0 ? 'text-green-600' : 'text-red-600';
    
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lineName}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm ${activePowerColor}">${link.active_power.toFixed(2)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm ${reactivePowerColor}">${link.reactive_power.toFixed(2)}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * 根据电压值获取颜色类名
 * @param {number} voltage - 电压值
 * @returns {string} 颜色类名
 */
getVoltageColor(voltage) {
  if (voltage < 0.95) return 'text-red-600';
  if (voltage < 0.98) return 'text-orange-600';
  if (voltage > 1.05) return 'text-red-600';
  if (voltage > 1.02) return 'text-orange-600';
  return 'text-green-600';
}/**

     * 更新图表数据

     */

  updateCharts() {
    // 更新电压图表

    if (this.state.voltageChart) {
      this.state.voltageChart.data.labels = this.state.nodes.map(n => n.id);

      this.state.voltageChart.data.datasets[0].data = this.state.nodes.map(n => n.voltage);

      this.state.voltageChart.update('none');
    } // 更新潮流图表

    if (this.state.powerFlowChart) {
      this.state.powerFlowChart.data.labels = this.state.links.map(
        l => `${l.source.id || l.source}→${l.target.id || l.target}`
      );

      this.state.powerFlowChart.data.datasets[0].data = this.state.links.map(l => l.active_power);

      this.state.powerFlowChart.data.datasets[1].data = this.state.links.map(l => l.reactive_power);

      this.state.powerFlowChart.update('none');
    }
    // 在updateCharts()函数末尾添加
// 检查当前显示模式并更新表格
const voltageToggle = document.getElementById('voltage-display-toggle');
if (voltageToggle && voltageToggle.checked) {
  this.updateVoltageTable();
}

const powerFlowToggle = document.getElementById('power-flow-display-toggle');
if (powerFlowToggle && powerFlowToggle.checked) {
  this.updatePowerFlowTable();
}
  } /**

     * 更新统计信息

     */

 updateStatistics() {
    const slackGeneration = this.state.nodes
      .filter(d => d.type === 'slack')
      .reduce((sum, d) => sum + Math.abs(d.active_power), 0);
      
    const pvGeneration = this.state.nodes
      .filter(d => d.type === 'pv')
      .reduce((sum, d) => sum + d.active_power, 0);
      
    const generatorGeneration = this.state.nodes
      .filter(d => d.type === 'generator')
      .reduce((sum, d) => sum + d.active_power, 0);
      
    const totalGeneration = slackGeneration + pvGeneration + generatorGeneration;
    
    const load = this.state.nodes
      .filter(d => d.type === 'load')
      .reduce((sum, d) => sum + Math.abs(d.active_power), 0);

    const totalNodes = document.getElementById('total-nodes');
    const totalLinks = document.getElementById('total-links');
    const totalGenerationElement = document.getElementById('total-generation');
    const totalLoad = document.getElementById('total-load');

    if (totalNodes) totalNodes.textContent = this.state.nodes.length;
    if (totalLinks) totalLinks.textContent = this.state.links.length;
    if (totalGenerationElement) totalGenerationElement.textContent = totalGeneration.toFixed(1) + ' MW';
    if (totalLoad) totalLoad.textContent = load.toFixed(1) + ' MW';
  } /**

     * 绑定事件处理
     */

  bindEvents() {
    // 计算按钮
    const calculateBtn = document.getElementById('calculate-btn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', () => this.calculatePowerFlow());
    }
    
    // 缩放控制
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const resetView = document.getElementById('reset-view');
    if (zoomIn) zoomIn.addEventListener('click', () => this.zoomIn());
    if (zoomOut) zoomOut.addEventListener('click', () => this.zoomOut());
    if (resetView) resetView.addEventListener('click', () => this.resetView());
    
    // 添加节点按钮
    const addGeneratorBtn = document.getElementById('add-generator');
    const addLoadBtn = document.getElementById('add-load');
    if (addGeneratorBtn) addGeneratorBtn.addEventListener('click', () => this.addNode('generator'));
    if (addLoadBtn) addLoadBtn.addEventListener('click', () => this.addNode('load'));

    // 连接线操作按钮
    const startLinkBtn = document.getElementById('start-link-creation');
    const cancelLinkBtn = document.getElementById('cancel-link-creation');
    const deleteLinkBtn = document.getElementById('delete-link');

    if (startLinkBtn) {
      startLinkBtn.addEventListener('click', () => {
        this.startLinkCreation();
        startLinkBtn.classList.add('hidden');
        cancelLinkBtn.classList.remove('hidden');
      });
    }

    if (cancelLinkBtn) {
      cancelLinkBtn.addEventListener('click', () => {
        this.cancelLinkCreation();
        cancelLinkBtn.classList.add('hidden');
        startLinkBtn.classList.remove('hidden');
      });
    }
    
    if (deleteLinkBtn) {
      deleteLinkBtn.addEventListener('click', () => {
        this.deleteSelectedLink();
      });
    }
    // 在bindEvents()函数末尾添加
  this.initDisplayToggle();
  
  // 初始化案例选择器事件监听
  const caseSelector = document.getElementById('case-selector');
  if (caseSelector) {
    caseSelector.addEventListener('change', (event) => {
      const selectedCase = event.target.value;
      if (selectedCase && window.powerFlowApp) {
        window.powerFlowApp.loadCaseData(selectedCase);
      }
    });
  }

     // 节点编辑模态框事件
    const nodeEditForm = document.getElementById('node-edit-form');
    if (nodeEditForm) {
      nodeEditForm.addEventListener('submit', (e) => this.saveNodeEdit(e));
    }
    
    const cancelEditBtn = document.getElementById('cancel-edit');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => this.closeNodeEditModal());
    }
    
    const nodeTypeSelect = document.getElementById('node-type');
    if (nodeTypeSelect) {
      nodeTypeSelect.addEventListener('change', (e) => {
        this.updateNodeEditForm(e.target.value);
      });
    }

     // 点击模态框外部关闭
    const modal = document.getElementById('node-edit-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeNodeEditModal();
        }
      });
    }

    // 连接线编辑模态框事件
    const linkEditForm = document.getElementById('link-edit-form');
    if (linkEditForm) {
      linkEditForm.addEventListener('submit', (e) => this.saveLinkEdit(e));
    }
    
    const cancelLinkEditBtn = document.getElementById('cancel-link-edit');
    if (cancelLinkEditBtn) {
      cancelLinkEditBtn.addEventListener('click', () => this.cancelLinkEdit());
    }
    
    // 点击连接线编辑模态框外部关闭
    const linkModal = document.getElementById('link-edit-modal');
    if (linkModal) {
      linkModal.addEventListener('click', (e) => {
        if (e.target === linkModal) {
          this.cancelLinkEdit();
        }
      });
    }
  
  // 窗口大小变化时重绘
  window.addEventListener('resize', this.handleResize);
  }/**

     * 计算潮流

     */

  async calculatePowerFlow() {
    try {
      // 计算前停止模拟以释放资源

      this.stopSimulation(); // 显示加载状态

      this.showLoadingIndicator(); // 获取选中的计算方法

      // 在calculatePowerFlow函数中添加
function updateStats(stats) {
    if (!stats) return;
    
    document.getElementById('voltage-max').textContent = stats.voltage.max + ' p.u.';
    document.getElementById('voltage-min').textContent = stats.voltage.min + ' p.u.';
    document.getElementById('voltage-avg').textContent = stats.voltage.avg + ' p.u.';
    
    document.getElementById('gen-total').textContent = stats.generation.total + ' MW';
    document.getElementById('loss-p').textContent = stats.losses.P + ' MW';
    document.getElementById('loss-q').textContent = stats.losses.Q + ' MVar';
    
    document.getElementById('branch-max').textContent = stats.branch.max_load + '%';
    document.getElementById('branch-avg').textContent = stats.branch.avg_load + '%';
    document.getElementById('overload-count').textContent = stats.branch.overload_count + ' 条';
}

      

      const calculationMethod = document.getElementById('calculation-method')?.value || 'newton-raphson';

      const response = await fetch('/api/calculate-flow', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
          nodes: this.state.nodes,

          links: this.state.links,

          method: calculationMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(errorData.error || `计算请求失败: ${response.statusText}`);
      }

      const result = await response.json(); // 更新数据

            // 更新统计数据（新增）
      if (result.stats) {
        this.updateStats(result.stats);
      }
      
    
      this.state.nodes = result.nodes;

      this.state.links = result.links; // 更新可视化

      this.updateVisualization(); // 更新图表

      this.updateCharts(); // 更新统计

      this.updateStatistics();

      this.showSuccessNotification('潮流计算完成'); // 重新启动模拟

      this.startSimulation();
    } catch (error) {
      console.error('潮流计算失败:', error);

      this.showErrorNotification(`计算失败: ${error.message}`); // 即使出错也尝试重新启动模拟

      this.startSimulation();
    } finally {
      // 隐藏加载状态

      this.hideLoadingIndicator();
    }
  } /**

     * 可视化

     */

  updateVisualization() {
    // 确保连接线的source和target正确引用节点对象
    this.state.links.forEach(link => {
      // 如果source是对象但不是当前nodes数组中的对象引用，则重新匹配
      if (typeof link.source === 'object' && link.source.id) {
        const matchedNode = this.state.nodes.find(node => node.id === link.source.id);
        if (matchedNode && matchedNode !== link.source) {
          link.source = matchedNode;
        }
      } else if (typeof link.source === 'string') {
        link.source = this.state.nodes.find(node => node.id === link.source);
      }
      
      // 如果target是对象但不是当前nodes数组中的对象引用，则重新匹配
      if (typeof link.target === 'object' && link.target.id) {
        const matchedNode = this.state.nodes.find(node => node.id === link.target.id);
        if (matchedNode && matchedNode !== link.target) {
          link.target = matchedNode;
        }
      } else if (typeof link.target === 'string') {
        link.target = this.state.nodes.find(node => node.id === link.target);
      }
    });

    // 更新连接线 - 使用key函数确保数据一致性
    this.state.linkElements = this.state.linkElements
      .data(this.state.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join(
        enter => enter.append('line')
          .attr('stroke', '#999')
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead)')
          .on('mouseover', this.handleLinkMouseOver)
          .on('mouseout', this.handleLinkMouseOut)
          .on('click', this.handleLinkClick),
        update => update,
        exit => exit.remove()
      )
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const radius = 12;
        return d.target.x - (dx / length) * radius;
      })
      .attr('y2', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const radius = 12;
        return d.target.y - (dy / length) * radius;
      });

    // 更新节点
    this.state.nodeElements = this.state.nodeElements
      .data(this.state.nodes, d => d.id)
      .join('circle')
      .attr('r', 12)
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', d => (this.state.selectedNode === d.id ? '#000' : '#fff'))
      .attr('stroke-width', d => (this.state.selectedNode === d.id ? 3 : 2))
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', this.handleDragStart)
          .on('drag', this.handleDrag)
          .on('end', this.handleDragEnd)
      )
      .on('mouseover', this.handleNodeMouseOver)
      .on('mouseout', this.handleNodeMouseOut)
      .on('click', this.handleNodeClick);

    // 重启模拟
    if (this.state.nodes.length > 0) {
      this.state.simulation.nodes(this.state.nodes);

      if (this.state.links.length > 0) {
        this.state.simulation.force('link').links(this.state.links);
      }

      this.state.simulation.alpha(0.3).restart();
    }

    
  } /**

     * 显示节点提示框

     */

  showNodeTooltip(event, d) {
    this.state.tooltip
      .html(
        `

            <h4 class="font-bold">${d.id}</h4>

            <p><strong>类型:</strong> ${this.getNodeTypeName(d.type)}</p>

            <p><strong>电压:</strong> ${d.voltage.toFixed(3)} pu</p>

            <p><strong>相角:</strong> ${d.angle.toFixed(2)}°</p>

            <p><strong>有功功率:</strong> ${d.active_power.toFixed(1)} MW</p>

            <p><strong>无功功率:</strong> ${d.reactive_power.toFixed(1)} Mvar</p>

        `
      )

      .style('left', event.pageX + 10 + 'px')

      .style('top', event.pageY + 10 + 'px')

      .style('opacity', 1);
  } /**

     * 显示连接线提示框

     */

  showLinkTooltip(event, d) {
    const sourceId = d.source.id || d.source;

    const targetId = d.target.id || d.target;

    this.state.tooltip
      .html(
        `

            <h4 class="font-bold">${sourceId} → ${targetId}</h4>

            <p><strong>电阻:</strong> ${d.resistance.toFixed(4)} pu</p>

            <p><strong>电抗:</strong> ${d.reactance.toFixed(4)} pu</p>

            <p><strong>发出端有功:</strong> ${d.from_active.toFixed(1)} MW</p>

            <p><strong>发出端无功:</strong> ${d.from_reactive.toFixed(1)} Mvar</p>

            <p><strong>接收端有功:</strong> ${d.to_active.toFixed(1)} MW</p>

            <p><strong>接收端无功:</strong> ${d.to_reactive.toFixed(1)} Mvar</p>

            <p><strong>损耗有功:</strong> ${d.loss_active.toFixed(1)} MW</p>

            <p><strong>损耗无功:</strong> ${d.loss_reactive.toFixed(1)} Mvar</p>

        `
      )

      .style('left', event.pageX + 10 + 'px')

      .style('top', event.pageY + 10 + 'px')

      .style('opacity', 1);
  } /**

     * 隐藏提示框

     */

  hideTooltip() {
    this.state.tooltip.style('opacity', 0);
  }     /**
   * 显示节点信息面板
   */
  displayNodeInfo(d) {
    const panel = document.getElementById('node-info-panel');
    if (!panel) return;
    
    // 清空连接线信息面板
    const linkPanel = document.getElementById('link-info-panel');
    if (linkPanel) {
      linkPanel.innerHTML = '<div class="text-center text-gray-500 italic">请点击网络中的连接线查看详细信息</div>';
    }
    
    panel.innerHTML = `
            <h3 class="font-bold text-lg">${d.id}</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <div><span class="text-gray-500">类型:</span> ${this.getNodeTypeName(d.type)}</div>
                <div><span class="text-gray-500">电压:</span> ${d.voltage.toFixed(3)} pu</div>
                <div><span class="text-gray-500">相角:</span> ${d.angle.toFixed(2)}°</div>
                <div><span class="text-gray-500">有功功率:</span> ${d.active_power.toFixed(1)} MW</div>
                <div><span class="text-gray-500">无功功率:</span> ${d.reactive_power.toFixed(1)} Mvar</div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3">
                <button class="bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded text-sm transition" onclick="window.powerFlowApp.createNode()">
                    <i class="fa fa-plus mr-1"></i>创建
                </button>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white py-1.5 px-3 rounded text-sm transition" onclick="window.powerFlowApp.editNode('${d.id}')">
                    <i class="fa fa-edit mr-1"></i>编辑
                </button>
                <button class="bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm transition" onclick="window.powerFlowApp.deleteNode('${d.id}')">
                    <i class="fa fa-trash mr-1"></i>删除
                </button>
            </div>
        `;
  }




    clearNodeInfo() {
    // 清空节点信息面板
    const nodePanel = document.getElementById('node-info-panel');
    if (nodePanel) {
      nodePanel.innerHTML = '<div class="text-center text-gray-500 italic">请点击网络中的节点查看详细信息</div>';
    }
    
    // 清空连接线信息面板
    const linkPanel = document.getElementById('link-info-panel');
    if (linkPanel) {
      linkPanel.innerHTML = '<div class="text-center text-gray-500 italic">请点击网络中的连接线查看详细信息</div>';
    }
    
    // 清除选中状态
    this.state.selectedNode = null;
    this.state.selectedLink = null;
    
    // 重置节点和连接线样式
    if (this.state.nodeElements) {
      this.state.nodeElements
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    }
    
    if (this.state.linkElements) {
      this.state.linkElements
        .attr('stroke', '#999')
        .attr('stroke-width', 2);
    }
  } /**

     * 获取节点类型名称

     */

  getNodeTypeName(type) {
    const types = {
      slack: '平衡节点',
      pv: 'PV节点',
      generator: '发电机',
      load: 'PQ节点'
    };
    return types[type] || type;
  } /**

     * 缩放处理

     */

  handleZoom(event) {
    this.state.transform = event.transform;

    this.state.svg.attr('transform', event.transform);
  } /**

     * 放大视图

     */

  zoomIn() {
    const newScale = this.state.transform.k * 1.2;

    this.updateZoom(newScale);
  } /**

     * 缩小视图

     */

  zoomOut() {
    const newScale = this.state.transform.k / 1.2;

    this.updateZoom(newScale);
  } /**

     * 重置视图

     */

  resetView() {
    this.state.svg
      .transition()

      .duration(750)

      .call(d3.zoom().transform, d3.zoomIdentity);

    this.state.transform = d3.zoomIdentity;
  } /**

     * 更新缩放状态

     */

  updateZoom(newScale) {
    const container = document.getElementById('power-grid');

    const width = container.clientWidth;

    const height = container.clientHeight;

    const scaleChange = newScale / this.state.transform.k;

    const newX = width / 2 - (width / 2 - this.state.transform.x) * scaleChange;

    const newY = height / 2 - (height / 2 - this.state.transform.y) * scaleChange;

    const newTransform = d3.zoomIdentity

      .translate(newX, newY)

      .scale(newScale);

    this.state.svg
      .transition()

      .duration(300)

      .attr('transform', newTransform);

    this.state.transform = newTransform;
  } /**

     * 处理窗口大小变化 - 修复持续变长问题

     */

  handleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);

    this.resizeTimeout = setTimeout(() => {
      const container = document.getElementById('power-grid');

      const width = container.clientWidth;

      const height = container.clientHeight;

      d3.select('#power-grid svg')

        .attr('width', width)

        .attr('height', height);

      if (this.state.simulation) {
        this.state.simulation.force('center', d3.forceCenter(width / 2, height / 2));

        this.state.simulation.alpha(0.1).restart();
      } // 修复图表resize问题 - 只更新数据，不重设大小

      if (this.state.voltageChart) {
        this.state.voltageChart.update('none'); // 使用'none'模式避免动画
      }

      if (this.state.powerFlowChart) {
        this.state.powerFlowChart.update('none'); // 使用'none'模式避免动画
      }
    }, 200);
  } /**

     * 显示加载指示器

     */

  showLoadingIndicator() {
    const btn = document.getElementById('calculate-btn');

    if (btn) {
      btn.disabled = true;

      btn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>计算中...';
    }
  } /**

     * 隐藏加载指示器

     */

  hideLoadingIndicator() {
    const btn = document.getElementById('calculate-btn');

    if (btn) {
      btn.disabled = false;

      btn.innerHTML = '<i class="fa fa-calculator mr-2"></i>计算潮流';
    }
  } /**

     * 显示成功通知

     */

  showSuccessNotification(message) {
    this.showNotification(message, 'success');
  } /**

     * 显示错误通知

     */

  showErrorNotification(message) {
    this.showNotification(message, 'error');
  } /**
   * 显示通知
   */

  showNotification(message, type = 'info') {
    d3.select('#notification').remove();

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const notification = d3
      .select('body')
      .append('div')
      .attr('id', 'notification')
      .attr(
        'class',
        `fixed top-4 right-4 p-4 rounded shadow-lg z-50 transform transition-all duration-300 translate-x-full ${bgColor} text-white`
      )
      .text(message);

    setTimeout(() => {
      notification.style('transform', 'translateX(0)');
    }, 10);

    setTimeout(() => {
      notification.style('transform', 'translateX(calc(100% + 20px))');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * 显示信息通知
   */
  showInfoNotification(message) {
    this.showNotification(message, 'info');
  }

  /**
   * 隐藏信息通知
   */
  hideInfoNotification() {
    d3.select('#notification').remove();
  }

  /**
   * 开始连接线创建模式
   */
  startLinkCreation() {
    this.state.linkCreationMode = true;
    this.state.selectedLinkSource = null;
    this.showInfoNotification('请点击起始节点，然后点击目标节点创建连接线');
  }

  /**
   * 取消连接线创建模式
   */
  cancelLinkCreation() {
    this.state.linkCreationMode = false;
    this.state.selectedLinkSource = null;
    if (this.state.tempLinkLine) {
      this.state.tempLinkLine.remove();
      this.state.tempLinkLine = null;
    }
    this.hideInfoNotification();

    // 重置按钮状态
    const startLinkBtn = document.getElementById('start-link-creation');
    const cancelLinkBtn = document.getElementById('cancel-link-creation');

    if (startLinkBtn && cancelLinkBtn) {
      startLinkBtn.classList.remove('hidden');
      cancelLinkBtn.classList.add('hidden');
    }

    // 重置节点高亮状态
    if (this.state.nodeElements) {
      this.state.nodeElements
        .attr('stroke', node => (node.id === this.state.selectedNode ? '#ff6b6b' : null))
        .attr('stroke-width', node => (node.id === this.state.selectedNode ? 2 : 1));
    }
  }

  /**
   * 处理节点点击事件（用于连接线创建）
   */
  handleNodeClickForLinkCreation(event, d) {
    if (!this.state.linkCreationMode) return;

    if (!this.state.selectedLinkSource) {
      // 选择起始节点
      this.state.selectedLinkSource = d;
      this.showInfoNotification(`已选择起始节点: ${d.id}，请点击目标节点`);

      // 高亮显示起始节点
      d3.select(event.currentTarget).attr('stroke', '#ff6b6b').attr('stroke-width', 3);
    } else {
      // 选择目标节点
      if (this.state.selectedLinkSource.id === d.id) {
        this.showErrorNotification('不能连接到自身节点');
        return;
      }

      // 检查是否已存在连接
      const existingLink = this.state.links.find(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        return (
          (sourceId === this.state.selectedLinkSource.id && targetId === d.id) ||
          (sourceId === d.id && targetId === this.state.selectedLinkSource.id)
        );
      });

      if (existingLink) {
        this.showErrorNotification('节点间已存在连接');
        return;
      }

      // 创建新连接
      this.addLink(this.state.selectedLinkSource.id, d.id);
      this.cancelLinkCreation();
    }
  }

  /**
   * 添加连接线
   */
  addLink(sourceId, targetId) {
    const newLink = {
      source: sourceId,
      target: targetId,
      resistance: 0.01,
      reactance: 0.1,
      active_power: 75, // 修改为合理的默认值，与初始连接线保持一致
      reactive_power: 30,
    };

    this.state.links.push(newLink);
    this.updateVisualization();
    this.updateStatistics();
    this.showSuccessNotification(`已添加连接线: ${sourceId} → ${targetId}`);
  } /**

     * 事件处理 - 节点鼠标悬停

     */

  handleNodeMouseOver(event, d) {
    d3.select(event.currentTarget)

      .attr('r', 14)

      .attr('stroke-width', 3);

    this.showNodeTooltip(event, d);
  } /**

     * 事件处理 - 节点鼠标离开

     */

  handleNodeMouseOut(event, d) {
    if (this.state.selectedNode !== d.id) {
      d3.select(event.currentTarget)

        .attr('r', 12)

        .attr('stroke-width', 2);
    }

    this.hideTooltip();
  } /**
   * 事件处理 - 节点点击
   */

    handleNodeClick(event, d) {
    // 如果在连接线创建模式下，使用专用处理函数
    if (this.state.linkCreationMode) {
      this.handleNodeClickForLinkCreation(event, d);
      return;
    }

    // 正常处理节点信息显示
    this.state.selectedNode = d.id === this.state.selectedNode ? null : d.id;
    this.state.selectedLink = null; // 清除连接线选中状态

    // 更新节点样式
    this.state.nodeElements
      .attr('stroke', node => (node.id === this.state.selectedNode ? '#ff6b6b' : '#fff'))
      .attr('stroke-width', node => (node.id === this.state.selectedNode ? 3 : 2));
    
    // 重置连接线样式
    this.state.linkElements
      .attr('stroke', '#999')
      .attr('stroke-width', 2);

    if (this.state.selectedNode) {
      this.displayNodeInfo(d);
    } else {
      this.clearNodeInfo();
    }
  } /**
   * 事件处理 - 连接线鼠标悬停
   */
  handleLinkMouseOver(event, d) {
    d3.select(event.currentTarget)
      .attr('stroke', '#333')
      .attr('stroke-width', 3);  // 使用固定的悬停粗细
    this.showLinkTooltip(event, d);
  }
  /**
   * 事件处理 - 连接线鼠标离开
   */
  handleLinkMouseOut(event) {
    d3.select(event.currentTarget)
      .attr('stroke', '#999')
      .attr('stroke-width', 2);  // 使用固定的正常粗细
    this.hideTooltip();
  } /**

     * 事件处理 - 连接线点击

     */

  handleLinkClick(event, d) {
    // 设置选中的连接线
    this.state.selectedLink = d;
    this.state.selectedNode = null; // 清除节点选中状态
    
    // 更新连接线样式
    this.state.linkElements
      .attr('stroke', link => (link === d ? '#ff6b6b' : '#999'))
      .attr('stroke-width', link => (link === d ? 3 : 2));
    
    // 重置节点样式
    this.state.nodeElements
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    this.displayLinkInfo(d);
  } /**

     * 事件处理 - 拖拽开始

     */

  handleDragStart(event, d) {
    if (!event.active) this.state.simulation.alphaTarget(0.3).restart();

    d.fx = d.x;

    d.fy = d.y;
  } /**

     * 事件处理 - 拖拽中

     */

  handleDrag(event, d) {
    d.fx = event.x;

    d.fy = event.y;
  } /**

     * 事件处理 - 拖拽结束

     */

  handleDragEnd(event, d) {
    if (!event.active) this.state.simulation.alphaTarget(0);

    d.fx = null;

    d.fy = null;
  } 
  /**
   * 添加新节点 - 区分发电机和PV节点
   */
  addNode(type) {
    const container = document.getElementById('power-grid');
    const svgElement = container.querySelector('svg');
    const width = svgElement.clientWidth;
    const height = svgElement.clientHeight;
    
    const transform = this.state.transform;
    const centerX = (width / 2 - transform.x) / transform.k;
    const centerY = (height / 2 - transform.y) / transform.k;
    
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    
    let newNode;
    
    if (type === 'slack') {
      newNode = {
        id: `slack${this.state.nodes.length + 1}`,
        type: 'slack',
        x: centerX + offsetX,
        y: centerY + offsetY,
        voltage: 1.0,  // 平衡节点电压固定
        angle: 0.0,   // 平衡节点相角固定
        active_power: 0,    // 平衡节点功率由计算决定
        reactive_power: 0
      };
    } else if (type === 'pv') {
      newNode = {
        id: `pv${this.state.nodes.length + 1}`,
        type: 'pv',
        x: centerX + offsetX,
        y: centerY + offsetY,
        voltage: 1.02, // PV节点控制电压
        angle: 0.0,    // PV节点相角由计算决定
        active_power: 100,  // PV节点输出有功功率
        reactive_power: 0   // PV节点无功功率由计算决定
      };
    } else if (type === 'generator') {
      newNode = {
        id: `gen${this.state.nodes.length + 1}`,
        type: 'generator',
        x: centerX + offsetX,
        y: centerY + offsetY,
        voltage: 1.0,   // 发电机节点电压由计算决定
        angle: 0.0,     // 发电机节点相角由计算决定
        active_power: 100,   // 发电机节点输出有功功率
        reactive_power: 50   // 发电机节点输出无功功率
      };
    } else if (type === 'load') {
      newNode = {
        id: `load${this.state.nodes.length + 1}`,
        type: 'load',
        x: centerX + offsetX,
        y: centerY + offsetY,
        voltage: 0.98,  // 负荷节点电压由计算决定
        angle: 0.0,    // 负荷节点相角由计算决定
        active_power: -50,   // 负荷节点消耗有功功率
        reactive_power: -20  // 负荷节点消耗无功功率
      };
    }
    
    this.state.nodes.push(newNode);
    this.updateVisualization();
    this.updateStatistics();
    this.showSuccessNotification(`已添加${this.getNodeTypeName(type)}节点: ${newNode.id}`);
  }
  /**
     * 删除节点
     */
  deleteNode(nodeId) {
    if (confirm(`确定要删除节点 ${nodeId} 吗？`)) {
      // 删除与该节点相关的所有连接
      this.state.links = this.state.links.filter(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        return sourceId !== nodeId && targetId !== nodeId;
      }); // 删除节点
      this.state.nodes = this.state.nodes.filter(node => node.id !== nodeId); // 如果删除的是当前选中的节点，清除选中状态
      if (this.state.selectedNode === nodeId) {
        this.state.selectedNode = null;
      }
      this.updateVisualization();
      this.updateStatistics();
      this.showSuccessNotification(`已删除节点: ${nodeId}`);
    }
  }
  
    /**
   * 编辑节点
   */
  editNode(nodeId) {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node) {
      this.showErrorNotification('节点不存在');
      return;
    }
    
    // 填充编辑表单
    document.getElementById('node-id').value = node.id;
    document.getElementById('node-type').value = node.type;
    document.getElementById('node-voltage').value = node.voltage;
    document.getElementById('node-angle').value = node.angle;
    document.getElementById('node-active-power').value = node.active_power;
    document.getElementById('node-reactive-power').value = node.reactive_power;
    
    // 根据节点类型显示/隐藏相应的输入字段
    this.updateNodeEditForm(node.type);
    
    // 显示编辑模态框
    const modal = document.getElementById('node-edit-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }
  
   /**
   * 根据节点类型更新编辑表单 - 按照PyPower逻辑区分
   */
  updateNodeEditForm(nodeType) {
    const voltageInput = document.getElementById('node-voltage');
    const angleInput = document.getElementById('node-angle');
    const activePowerInput = document.getElementById('node-active-power');
    const reactivePowerInput = document.getElementById('node-reactive-power');
    
    // 重置所有字段为可编辑
    voltageInput.disabled = false;
    angleInput.disabled = false;
    activePowerInput.disabled = false;
    reactivePowerInput.disabled = false;
    
    // 根据节点类型设置字段的可编辑性
    if (nodeType === 'slack') {
      // 平衡节点：电压和相角固定，功率由计算决定
      voltageInput.disabled = true;
      angleInput.disabled = true;
      activePowerInput.disabled = true;
      reactivePowerInput.disabled = true;
    } else if (nodeType === 'pv') {
      // PV节点：电压固定，可编辑有功功率，无功功率由计算决定
      voltageInput.disabled = false;
      angleInput.disabled = true;
      activePowerInput.disabled = false;
      reactivePowerInput.disabled = true;
    } else if (nodeType === 'generator') {
      // 发电机节点：可编辑有功和无功功率，电压和相角由计算决定
      voltageInput.disabled = false;
      angleInput.disabled = true;
      activePowerInput.disabled = false;
      reactivePowerInput.disabled = true;
    } else if (nodeType === 'load') {
      // PQ节点：可编辑有功功率和无功功率，电压和相角由计算决定
      voltageInput.disabled = true;
      angleInput.disabled = true;
      activePowerInput.disabled = false;
      reactivePowerInput.disabled = false;
    }
  }
  /**
   * 保存节点编辑 - 确保PV节点有功功率为正
   */
  saveNodeEdit(event) {
    event.preventDefault();
    
    const nodeId = document.getElementById('node-id').value;
    let nodeType = document.getElementById('node-type').value;
    const voltage = parseFloat(document.getElementById('node-voltage').value);
    const angle = parseFloat(document.getElementById('node-angle').value);
    let activePower = parseFloat(document.getElementById('node-active-power').value);
    const reactivePower = parseFloat(document.getElementById('node-reactive-power').value);
    
    // 验证输入
    if (isNaN(voltage) || isNaN(angle) || isNaN(activePower) || isNaN(reactivePower)) {
      this.showErrorNotification('请输入有效的数值');
      return;
    }
    
    // 查找并更新节点
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (node) {
      // 如果没有选择类型，保持原来的类型不变
      if (!nodeType) {
        nodeType = node.type;
      }
      
      // 确保PV节点和发电机节点的有功功率为正
      if ((nodeType === 'pv' || nodeType === 'generator') && activePower < 0) {
        activePower = Math.abs(activePower);
        this.showInfoNotification(`${nodeType === 'pv' ? 'PV' : '发电机'}节点的有功功率已自动调整为正值: ${activePower} MW`);
      }
      
      node.type = nodeType;
      node.voltage = voltage;
      node.angle = angle;
      node.active_power = activePower;
      node.reactive_power = reactivePower;
      
      // 更新可视化
      this.updateVisualization();
      this.updateStatistics();
      
      // 如果当前选中的是被编辑的节点，更新信息面板
      if (this.state.selectedNode === nodeId) {
        this.displayNodeInfo(node);
      }
      
      this.showSuccessNotification(`节点 ${nodeId} 已更新`);
    }
    
    // 关闭模态框
    this.closeNodeEditModal();
  }

  
  /**
   * 关闭节点编辑模态框
   */
  closeNodeEditModal() {
    const modal = document.getElementById('node-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  /**
 * 创建节点
 */
createNode() {
    alert('创建新节点功能 - 请点击可视化面板右下角图例来创建新节点');
  }

  deleteSelectedLink() {
    if (this.state.selectedLink) {
      const sourceId = this.state.selectedLink.source.id || this.state.selectedLink.source;
      const targetId = this.state.selectedLink.target.id || this.state.selectedLink.target;
      
      if (confirm(`确定要删除连接线 ${sourceId} → ${targetId} 吗？`)) {
        // 删除连接线
        this.state.links = this.state.links.filter(link => {
          const linkSourceId = link.source.id || link.source;
          const linkTargetId = link.target.id || link.target;
          return !(linkSourceId === sourceId && linkTargetId === targetId);
        });
        
        // 清除选中状态
        this.state.selectedLink = null;
        
        // 更新可视化
        this.updateVisualization();
        this.updateStatistics();
        this.clearNodeInfo();
        this.showSuccessNotification(`已删除连接线: ${sourceId} → ${targetId}`);
      }
    } else {
      alert('请先选择要删除的连接线');
    }
  }

    showHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }
  
  hideHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
    /**
   * 显示连接线信息
   */
  displayLinkInfo(link) {
    if (!link) return;
    
    // 获取连接线两端节点
    const sourceId = link.source.id || link.source;
    const targetId = link.target.id || link.target;
    const sourceNode = this.state.nodes.find(n => n.id === sourceId);
    const targetNode = this.state.nodes.find(n => n.id === targetId);
    
    // 清空节点信息面板
    const nodePanel = document.getElementById('node-info-panel');
    if (nodePanel) {
      nodePanel.innerHTML = '<div class="text-center text-gray-500 italic">请点击网络中的节点查看详细信息</div>';
    }
    
    // 更新连接线信息面板
    const infoPanel = document.getElementById('link-info-panel');
    if (infoPanel) {
      infoPanel.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-lg">${sourceId} → ${targetId}</h3>
                <button onclick="window.powerFlowApp.editLink('${sourceId}-${targetId}')" class="text-blue-500 hover:text-blue-700 text-sm">
                    <i class="fa fa-edit"></i> 编辑
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><span class="text-gray-500">电阻:</span> ${(link.resistance || 0).toFixed(3)} pu</div>
                <div><span class="text-gray-500">电抗:</span> ${(link.reactance || 0).toFixed(3)} pu</div>
                <div><span class="text-gray-500">发出端有功:</span> ${(link.from_active || 0).toFixed(2)} MW</div>
                <div><span class="text-gray-500">发出端无功:</span> ${(link.from_reactive || 0).toFixed(2)} Mvar</div>
                <div><span class="text-gray-500">接收端有功:</span> ${(link.to_active || 0).toFixed(2)} MW</div>
                <div><span class="text-gray-500">接收端无功:</span> ${(link.to_reactive || 0).toFixed(2)} Mvar</div>
                <div><span class="text-gray-500">有功损耗:</span> ${(link.loss_active || 0).toFixed(2)} MW</div>
                <div><span class="text-gray-500">无功损耗:</span> ${(link.loss_reactive || 0).toFixed(2)} Mvar</div>
            </div>
        `;
    }
    
    // 更新选中状态
    this.state.selectedLink = link;
  }

  
  /**
   * 编辑连接线
   */
  editLink(linkId) {
    const [sourceId, targetId] = linkId.split('-');
    const link = this.state.links.find(l => {
      const lSourceId = l.source.id || l.source;
      const lTargetId = l.target.id || l.target;
      return lSourceId === sourceId && lTargetId === targetId;
    });
    
    if (!link) {
      this.showErrorNotification('连接线不存在');
      return;
    }
    
    // 填充编辑表单
    document.getElementById('link-id').value = linkId;
    document.getElementById('link-name').value = `${sourceId} → ${targetId}`;
    document.getElementById('link-resistance').value = link.resistance || 0;
    document.getElementById('link-reactance').value = link.reactance || 0;
    document.getElementById('link-from-active').value = link.from_active || 0;
    document.getElementById('link-from-reactive').value = link.from_reactive || 0;
    document.getElementById('link-to-active').value = link.to_active || 0;
    document.getElementById('link-to-reactive').value = link.to_reactive || 0;
    document.getElementById('link-loss-active').value = link.loss_active || 0;
    document.getElementById('link-loss-reactive').value = link.loss_reactive || 0;
    
    // 显示编辑模态框
    const modal = document.getElementById('link-edit-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }
  
  /**
   * 保存连接线编辑
   */
  saveLinkEdit(event) {
    event.preventDefault();
    
    const linkId = document.getElementById('link-id').value;
    const resistance = parseFloat(document.getElementById('link-resistance').value);
    const reactance = parseFloat(document.getElementById('link-reactance').value);
    
    const [sourceId, targetId] = linkId.split('-');
    const link = this.state.links.find(l => {
      const lSourceId = l.source.id || l.source;
      const lTargetId = l.target.id || l.target;
      return lSourceId === sourceId && lTargetId === targetId;
    });
    
    if (link) {
      // 更新连接线参数
      link.resistance = resistance;
      link.reactance = reactance;
      
      // 重新计算潮流
      this.calculatePowerFlow();
      
      // 更新可视化
      this.updateVisualization();
      
      // 更新连接线信息显示
      this.displayLinkInfo(link);
      
      // 隐藏编辑模态框
      const modal = document.getElementById('link-edit-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
      
      this.showSuccessNotification('连接线参数已更新');
    }
  }
  
  /**
   * 取消连接线编辑
   */
  cancelLinkEdit() {
    const modal = document.getElementById('link-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

    // 在PowerFlowVisualization类中添加新函数
  updateStats(stats) {
    if (!stats) return;
    
    // 更新电压统计
    const voltageElements = document.querySelectorAll('[id^="voltage-"]');
    voltageElements.forEach(el => {
      if (el.id === 'voltage-max') el.textContent = stats.voltage.max + ' p.u.';
      if (el.id === 'voltage-min') el.textContent = stats.voltage.min + ' p.u.';
      if (el.id === 'voltage-avg') el.textContent = stats.voltage.avg + ' p.u.';
    });
    
    // 更新功率统计
    const genTotal = document.getElementById('gen-total');
    const lossP = document.getElementById('loss-p');
    const lossQ = document.getElementById('loss-q');
    
    if (genTotal) genTotal.textContent = stats.generation.total + ' MW';
    if (lossP) lossP.textContent = stats.losses.P + ' MW';
    if (lossQ) lossQ.textContent = stats.losses.Q + ' MVar';
    
    // 更新网络拓扑统计
    const topologyTotalBranches = document.getElementById('topology-total-branches');
    const topologyTotalBuses = document.getElementById('topology-total-buses');
    const topologyDensity = document.getElementById('topology-density');
    const topologyConnectivity = document.getElementById('topology-connectivity');
    
    if (topologyTotalBranches) topologyTotalBranches.textContent = stats.topology.total_branches;
    if (topologyTotalBuses) topologyTotalBuses.textContent = stats.topology.total_buses;
    if (topologyDensity) topologyDensity.textContent = stats.topology.network_density;
    if (topologyConnectivity) topologyConnectivity.textContent = stats.topology.average_connectivity;

  }
}
// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  // 确保Chart.js和D3.js已加载
  if (typeof d3 === 'undefined' || typeof Chart === 'undefined') {
    console.error('依赖库未加载');
    alert('可视化依赖库加载失败，请刷新页面重试');
    return;
  } // 初始化电力潮流可视化应用
  window.powerFlowApp = new PowerFlowVisualization();
  console.log('电力潮流可视化应用已启动');
});