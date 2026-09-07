package net.mlultimate.client.modules.performance;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;

/**
 * High-efficiency Performance Engine module for MLUltimate Client.
 * Manages frame rate stabilization, allocation reduction and entity culling.
 */
public class PerformanceModule extends Module {

    private final BooleanSetting fastMathSetting;
    private final BooleanSetting reduceParticlesSetting;
    private final BooleanSetting memoryOptimizationSetting;
    private final BooleanSetting lazyChunkUpdatesSetting;

    public PerformanceModule() {
        super("performance", "Otimização de FPS", "Redução de overhead e estabilização de FPS", Category.PERFORMANCE);
        this.fastMathSetting = new BooleanSetting("fast_math", "Fast Math", "Utiliza tabelas pré-computadas de seno/cosseno", true);
        this.reduceParticlesSetting = new BooleanSetting("reduce_particles", "Reduzir Partículas", "Limita partículas supérfluas em combate intenso", true);
        this.memoryOptimizationSetting = new BooleanSetting("memory_opt", "Gerenciamento de RAM", "Evita alocações desnecessárias no heap", true);
        this.lazyChunkUpdatesSetting = new BooleanSetting("lazy_chunks", "Atualização Suave de Chunks", "Distribui renderização de chunks de forma balanceada", true);

        registerSetting(fastMathSetting);
        registerSetting(reduceParticlesSetting);
        registerSetting(memoryOptimizationSetting);
        registerSetting(lazyChunkUpdatesSetting);
        setEnabled(true);
    }

    public boolean isFastMath() { return fastMathSetting.isEnabled(); }
    public boolean isReduceParticles() { return reduceParticlesSetting.isEnabled(); }
    public boolean isMemoryOptimization() { return memoryOptimizationSetting.isEnabled(); }
    public boolean isLazyChunkUpdates() { return lazyChunkUpdatesSetting.isEnabled(); }
}
