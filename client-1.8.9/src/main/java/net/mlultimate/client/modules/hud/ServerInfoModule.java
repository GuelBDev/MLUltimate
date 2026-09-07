package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;

public class ServerInfoModule extends Module {

    private final BooleanSetting showIpSetting;
    private final BooleanSetting showPlayerCountSetting;

    public ServerInfoModule() {
        super("server_info", "Info do Servidor", "Endereço IP e jogadores conectados", Category.SERVER);
        this.showIpSetting = new BooleanSetting("show_ip", "Mostrar IP", "Exibir IP do servidor atual", true);
        this.showPlayerCountSetting = new BooleanSetting("show_players", "Contador de Jogadores", "Exibir quantidade de players", true);

        registerSetting(showIpSetting);
        registerSetting(showPlayerCountSetting);
        setEnabled(true);
    }

    public boolean isShowIp() {
        return showIpSetting.isEnabled();
    }

    public boolean isShowPlayerCount() {
        return showPlayerCountSetting.isEnabled();
    }
}
